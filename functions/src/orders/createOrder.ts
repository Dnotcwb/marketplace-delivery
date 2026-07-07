import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getStripe, CONSUMIDOR_URL } from '../payments/stripeClient'

// ──────────────────────────────────────────────────────
//  Tipos de entrada
// ──────────────────────────────────────────────────────

interface OrderItemInput {
  /** ID do produtor dono deste item dentro da horta */
  produtorId: string
  productId: string
  quantity: number
  notes?: string
}

interface DeliveryAddressInput {
  label: string
  recipientName: string
  phone: string
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
}

interface CreateOrderInput {
  hortaId: string
  items: OrderItemInput[]
  deliveryAddress: DeliveryAddressInput
  paymentMethod: 'pix' | 'credit_card'
  couponCode?: string
}

// ──────────────────────────────────────────────────────
//  Helpers de frete dinâmico
// ──────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function geocodeCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const headers = { 'User-Agent': 'marketplace-delivery-functions/1.0' }

  try {
    // Tentativa 1: Nominatim por CEP
    const r1 = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`,
      { headers },
    )
    if (r1.ok) {
      const d1 = (await r1.json()) as Array<{ lat: string; lon: string }>
      if (d1.length > 0) return { lat: parseFloat(d1[0]!.lat), lng: parseFloat(d1[0]!.lon) }
    }
  } catch { /* fallback */ }

  try {
    // Tentativa 2: ViaCEP → cidade/UF → Nominatim por cidade
    const rCep = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!rCep.ok) return null
    const cepData = (await rCep.json()) as { erro?: boolean; localidade?: string; uf?: string }
    if (cepData.erro || !cepData.localidade || !cepData.uf) return null
    const city  = encodeURIComponent(cepData.localidade)
    const state = encodeURIComponent(cepData.uf)
    const r2 = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${city}&state=${state}&country=BR&format=json&limit=1`,
      { headers },
    )
    if (!r2.ok) return null
    const d2 = (await r2.json()) as Array<{ lat: string; lon: string }>
    if (!d2.length) return null
    return { lat: parseFloat(d2[0]!.lat), lng: parseFloat(d2[0]!.lon) }
  } catch {
    return null
  }
}

// Comissão da plataforma definida POR PRODUTOR em produtores/{id}.commission,
// como percentual 0–100 (é assim que o backoffice grava o campo).
const DEFAULT_COMMISSION_PCT = 10

function commissionPctOf(produtorData: FirebaseFirestore.DocumentData): number {
  const raw = produtorData['commission']
  return typeof raw === 'number' && raw >= 0 && raw <= 100 ? raw : DEFAULT_COMMISSION_PCT
}

export const createOrder = onCall(
  { region: 'southamerica-east1', secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    try {
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Usuário não autenticado')
      }

      const uid = request.auth.uid
      const data = request.data as CreateOrderInput

      console.log('createOrder início — uid:', uid, 'hortaId:', data?.hortaId)

      if (!data.hortaId || !data.items?.length || !data.deliveryAddress || !data.paymentMethod) {
        throw new HttpsError('invalid-argument', 'Dados inválidos')
      }

      if (data.items.length > 100) {
        throw new HttpsError('invalid-argument', 'Pedido excede o limite de itens')
      }
      for (const item of data.items) {
        if (!item.produtorId || !item.productId) {
          throw new HttpsError('invalid-argument', 'Item sem produto ou produtor')
        }
        if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) {
          throw new HttpsError('invalid-argument', 'Quantidade inválida em um dos itens')
        }
        if (item.notes && item.notes.length > 500) {
          throw new HttpsError('invalid-argument', 'Observação do item muito longa')
        }
      }

      const db = admin.firestore()

      // Modo demonstração (appConfig/platform.demoMode): opera sem pagamento
      // real — produtores vendem sem Stripe e o pedido é confirmado na hora.
      const platformCfgSnap = await db.collection('appConfig').doc('platform').get()
      const demoMode = platformCfgSnap.data()?.['demoMode'] === true

      // 1. Valida a horta
      console.log('Etapa 1: validando horta')
      const hortaSnap = await db.collection('hortas').doc(data.hortaId).get()
      if (!hortaSnap.exists) throw new HttpsError('not-found', 'Horta não encontrada')
      const horta = hortaSnap.data()!
      if (horta['status'] !== 'active') {
        throw new HttpsError('failed-precondition', 'Horta não está ativa')
      }

      // 2. Agrupa itens por produtor e valida cada produto
      console.log('Etapa 2: validando itens —', data.items.length, 'item(s)')

      const itemsByProdutor = new Map<string, OrderItemInput[]>()
      for (const item of data.items) {
        const list = itemsByProdutor.get(item.produtorId) ?? []
        list.push(item)
        itemsByProdutor.set(item.produtorId, list)
      }

      let subtotalGlobalInCents = 0
      const produtorGroups = new Map<string, {
        produtorData: FirebaseFirestore.DocumentData
        orderItems: Record<string, unknown>[]
        subtotalInCents: number
      }>()

      // Round 1: busca todos os produtores em paralelo
      const produtorEntries = [...itemsByProdutor.entries()]
      const produtorSnaps = await Promise.all(
        produtorEntries.map(([id]) => db.collection('produtores').doc(id).get()),
      )

      // Valida produtores
      const validatedProdutores: FirebaseFirestore.DocumentData[] = []
      for (let pi = 0; pi < produtorEntries.length; pi++) {
        const [produtorId] = produtorEntries[pi]!
        const snap = produtorSnaps[pi]!
        if (!snap.exists) throw new HttpsError('not-found', `Produtor ${produtorId} não encontrado`)
        const produtorData = snap.data()!
        if (produtorData['status'] !== 'approved') {
          throw new HttpsError('failed-precondition', `Produtor ${produtorData['name']} não está ativo`)
        }
        const hortaIdDoProd = produtorData['hortaId'] as string | undefined
        if (hortaIdDoProd && hortaIdDoProd !== data.hortaId) {
          throw new HttpsError('failed-precondition', `Produtor ${produtorData['name']} não pertence a esta horta`)
        }
        // Split via Stripe Connect: só pode vender quem tem conta apta a receber.
        // Em modo demonstração, esta exigência é ignorada (sem pagamento real).
        if (!demoMode && (produtorData['stripeOnboarded'] !== true || !produtorData['stripeAccountId'])) {
          throw new HttpsError(
            'failed-precondition',
            `${produtorData['name']} ainda não está apto a receber pagamentos. Tente novamente mais tarde.`,
          )
        }
        validatedProdutores.push(produtorData)
      }

      // Round 2: busca todos os produtos em paralelo (across all produtores)
      const allProductFetches = produtorEntries.flatMap(([produtorId, prodItems]) =>
        prodItems.map((item) =>
          db.collection('produtores').doc(produtorId)
            .collection('products').doc(item.productId)
            .get()
            .then((snap) => ({ produtorId, item, snap })),
        ),
      )
      const allProductResults = await Promise.all(allProductFetches)

      // Valida produtos
      for (const { item, snap } of allProductResults) {
        if (!snap.exists) throw new HttpsError('not-found', `Produto ${item.productId} não encontrado`)
        const product = snap.data()!
        if (!product['available']) throw new HttpsError('failed-precondition', `${product['name']} está indisponível`)
      }

      // Round 3: busca todas as categorias únicas em paralelo
      const seenCats = new Set<string>()
      const catFetches: Promise<{ produtorId: string; catId: string; snap: FirebaseFirestore.DocumentSnapshot }>[] = []
      for (const { produtorId, snap } of allProductResults) {
        const catId = snap.data()!['categoryId'] as string | undefined
        if (catId) {
          const key = `${produtorId}/${catId}`
          if (!seenCats.has(key)) {
            seenCats.add(key)
            catFetches.push(
              db.collection('produtores').doc(produtorId).collection('categories').doc(catId).get()
                .then((s) => ({ produtorId, catId, snap: s })),
            )
          }
        }
      }
      const catResults = await Promise.all(catFetches)
      const catNameMap = new Map<string, string>()
      for (const { produtorId, catId, snap } of catResults) {
        catNameMap.set(`${produtorId}/${catId}`, snap.exists ? ((snap.data()!['name'] as string) ?? '') : '')
      }

      // Mapa plano para acesso O(1): "produtorId/productId" → data
      const productDataMap = new Map<string, FirebaseFirestore.DocumentData>()
      for (const { produtorId, item, snap } of allProductResults) {
        productDataMap.set(`${produtorId}/${item.productId}`, snap.data()!)
      }

      // Constrói produtorGroups com dados já em memória
      for (let pi = 0; pi < produtorEntries.length; pi++) {
        const [produtorId, prodItems] = produtorEntries[pi]!
        const produtorData = validatedProdutores[pi]!

        let subtotalInCents = 0
        const orderItems: Record<string, unknown>[] = []

        for (const item of prodItems) {
          const product = productDataMap.get(`${produtorId}/${item.productId}`)!
          const catId = product['categoryId'] as string | undefined
          const categoryName = catId ? (catNameMap.get(`${produtorId}/${catId}`) ?? '') : ''

          subtotalInCents += (product['priceInCents'] as number) * item.quantity
          orderItems.push({
            productId: item.productId,
            productName: product['name'],
            categoryId: catId ?? '',
            categoryName,
            unit: product['unit'],
            priceInCents: product['priceInCents'],
            quantity: item.quantity,
            ...(product['photoUrl'] ? { photoUrl: product['photoUrl'] } : {}),
            ...(item.notes ? { notes: item.notes } : {}),
          })
        }

        subtotalGlobalInCents += subtotalInCents
        produtorGroups.set(produtorId, { produtorData, orderItems, subtotalInCents })
      }

      let deliveryFeeInCents = (horta['deliveryFeeInCents'] as number) ?? 0
      let deliveryDistanceKm: number | undefined

      const hortaLat = horta['lat'] as number | undefined
      const hortaLng = horta['lng'] as number | undefined
      const feePerKm = horta['deliveryFeePerKmInCents'] as number | undefined
      const deliveryRadiusKm = horta['deliveryRadiusKm'] as number | undefined

      if (hortaLat && hortaLng && feePerKm && feePerKm > 0) {
        console.log('Frete dinâmico ativo — geocodificando CEP do cliente:', data.deliveryAddress.cep)
        const coords = await geocodeCep(data.deliveryAddress.cep)
        if (coords) {
          const dist = haversineKm(hortaLat, hortaLng, coords.lat, coords.lng)
          deliveryDistanceKm = dist
          console.log(`Distância calculada: ${dist.toFixed(2)} km`)

          if (deliveryRadiusKm && deliveryRadiusKm > 0 && dist > deliveryRadiusKm) {
            throw new HttpsError(
              'failed-precondition',
              `Endereço fora da área de entrega (limite: ${deliveryRadiusKm} km)`,
            )
          }

          const dynamic = Math.round(dist * feePerKm)
          deliveryFeeInCents = Math.max(deliveryFeeInCents, dynamic)
          console.log(`Taxa de entrega dinâmica: R$ ${(deliveryFeeInCents / 100).toFixed(2)}`)
        } else {
          console.log('Geocodificação falhou — usando taxa fixa')
        }
      }

      const minOrder = (horta['minOrderValueInCents'] as number) ?? 0

      if (minOrder > 0 && subtotalGlobalInCents < minOrder) {
        throw new HttpsError(
          'failed-precondition',
          `Pedido mínimo: R$ ${(minOrder / 100).toFixed(2).replace('.', ',')}`,
        )
      }

      // 3-4. Cupom + dados do cliente
      console.log('Etapa 3: cupom —', data.couponCode ?? 'nenhum')
      const userSnap = await db.collection('users').doc(uid).get()

      let discountInCents = 0
      let couponCode: string | undefined

      if (data.couponCode) {
        const couponRef = db.collection('coupons').doc(data.couponCode.toUpperCase())
        // Transação: valida e consome o uso atomicamente — sem ela, duas
        // requisições simultâneas podem ultrapassar o maxUses.
        await db.runTransaction(async (tx) => {
          // Reinicia a cada tentativa (a transação pode ser reexecutada)
          discountInCents = 0
          couponCode = undefined

          const couponSnap = await tx.get(couponRef)
          if (!couponSnap.exists) return
          const c = couponSnap.data()!
          const now = new Date()
          const validFrom = c['validFrom'].toDate() as Date
          const validUntil = c['validUntil'].toDate() as Date
          const usesOk = !c['maxUses'] || (c['usedCount'] as number) < (c['maxUses'] as number)
          const minOk = !c['minOrderValueInCents'] || subtotalGlobalInCents >= (c['minOrderValueInCents'] as number)
          if (!(c['active'] && validFrom <= now && validUntil >= now && usesOk && minOk)) return

          couponCode = couponSnap.id
          if (c['type'] === 'percentage') {
            discountInCents = Math.floor(subtotalGlobalInCents * ((c['value'] as number) / 100))
          } else {
            discountInCents = c['value'] as number
          }
          if (c['maxDiscountInCents']) {
            discountInCents = Math.min(discountInCents, c['maxDiscountInCents'] as number)
          }
          discountInCents = Math.min(discountInCents, subtotalGlobalInCents)
          tx.update(couponRef, { usedCount: FieldValue.increment(1) })
        })
      }

      const totalInCents = subtotalGlobalInCents + deliveryFeeInCents - discountInCents
      console.log('Total calculado (cents):', totalInCents)

      console.log('Etapa 4: dados do cliente')
      const user = userSnap.data() ?? {}
      const customerName = (user['displayName'] as string) ?? (user['name'] as string) ?? ''
      const customerPhone = (user['phone'] as string) ?? ''

      // 5. Cria pedido pai
      console.log('Etapa 5: criando pedido pai')
      const orderRef = db.collection('orders').doc()
      const orderId = orderRef.id
      const tsNow = Timestamp.now()

      const deliveryAddressClean: Record<string, string> = {
        label: data.deliveryAddress.label,
        recipientName: data.deliveryAddress.recipientName,
        phone: data.deliveryAddress.phone,
        cep: data.deliveryAddress.cep,
        street: data.deliveryAddress.street,
        number: data.deliveryAddress.number,
        neighborhood: data.deliveryAddress.neighborhood,
        city: data.deliveryAddress.city,
        state: data.deliveryAddress.state,
      }
      if (data.deliveryAddress.complement) {
        deliveryAddressClean['complement'] = data.deliveryAddress.complement
      }

      // Campos de compatibilidade com o modelo legado
      const firstProdutorId = [...produtorGroups.keys()][0]!
      const firstGroup = produtorGroups.get(firstProdutorId)!

      await orderRef.set({
        customerId: uid,
        customerName,
        customerPhone,
        // Campos legado (manter para leituras existentes)
        produtorId: firstProdutorId,
        produtorName: firstGroup.produtorData['name'],
        produtorSlug: firstGroup.produtorData['slug'],
        // Campos novos
        hortaId: data.hortaId,
        pedidoFilhosCount: produtorGroups.size,
        items: [...produtorGroups.values()].flatMap((g) => g.orderItems),
        deliveryAddress: deliveryAddressClean,
        subtotalInCents: subtotalGlobalInCents,
        deliveryFeeInCents,
        ...(deliveryDistanceKm !== undefined ? { deliveryDistanceKm } : {}),
        discountInCents,
        totalInCents,
        ...(couponCode ? { couponCode } : {}),
        payment: { method: data.paymentMethod, status: 'pending' },
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: tsNow }],
        estimatedDeliveryTimeMin: horta['estimatedDeliveryTimeMin'] ?? 30,
        estimatedDeliveryTimeMax: horta['estimatedDeliveryTimeMax'] ?? 60,
        createdAt: FieldValue.serverTimestamp(),
      })
      console.log('Pedido pai criado — orderId:', orderId)

      // 6. Cria pedidos filhos (um por produtor)
      console.log('Etapa 6: criando', produtorGroups.size, 'pedido(s) filho(s)')

      const filhoBatch = db.batch()
      for (const [produtorId, group] of produtorGroups) {
        const commissionPct = commissionPctOf(group.produtorData)
        const valorRepasse = Math.round(group.subtotalInCents * (1 - commissionPct / 100))
        const filhoRef = db.collection('pedidos_filhos').doc()
        filhoBatch.set(filhoRef, {
          pedidoPaiId: orderId,
          hortaId: data.hortaId,
          produtorId,
          produtorName: group.produtorData['name'],
          customerId: uid,
          customerName,
          customerPhone,
          deliveryAddress: deliveryAddressClean,
          status: 'pendente',
          valorRepasseInCents: valorRepasse,
          // Destino do transfer (snapshot). Ausente em modo demonstração —
          // só incluído quando existe, pois o Firestore rejeita undefined.
          ...(group.produtorData['stripeAccountId']
            ? { stripeAccountId: group.produtorData['stripeAccountId'] }
            : {}),
          items: group.orderItems,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
      await filhoBatch.commit()
      console.log('Pedidos filhos criados')

      // 7a. Modo demonstração: sem pagamento real. Confirma o pedido na hora
      //     para que ele flua por todos os apps (produtor, entregador, etc.).
      if (demoMode) {
        await orderRef.update({
          status: 'confirmed',
          'payment.status': 'approved',
          'payment.paidAt': FieldValue.serverTimestamp(),
          statusHistory: FieldValue.arrayUnion({ status: 'confirmed', timestamp: tsNow }),
          confirmedAt: FieldValue.serverTimestamp(),
        })
        console.log('createOrder: modo demonstração — pedido confirmado sem pagamento', orderId)
        return { orderId, total: totalInCents, devMode: true }
      }

      // 7. Integração Stripe — cria uma Checkout Session hospedada.
      //    Modelo "separate charges and transfers": a cobrança vai para a
      //    plataforma; o split entre produtores acontece no webhook
      //    (payment_intent.succeeded) via Stripe Transfers.
      const stripeKey = process.env['STRIPE_SECRET_KEY']
      const skipStripe = process.env['SKIP_STRIPE'] === 'true'

      if (!stripeKey || skipStripe) {
        return { orderId, paymentMethod: data.paymentMethod, total: totalInCents, devMode: true }
      }

      const stripe = getStripe()
      const customerEmail = (request.auth?.token?.email as string | undefined) ?? undefined

      // Um único line_item com o total já calculado (subtotal + frete − desconto),
      // para a cobrança bater exatamente com totalInCents (o detalhamento dos
      // itens fica no próprio app, na tela do pedido).
      const itemCount = [...produtorGroups.values()].reduce((n, g) => n + g.orderItems.length, 0)
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Sem payment_method_types fixo: o Stripe Checkout oferece automaticamente
        // os métodos ativados no dashboard (cartão por padrão; PIX quando habilitado).
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'brl',
              unit_amount: totalInCents,
              product_data: {
                name: `Pedido ${orderId.slice(0, 8).toUpperCase()} — ${horta['name']}`,
                description: `${itemCount} item(ns) · ${produtorGroups.size} produtor(es)`,
              },
            },
          },
        ],
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        client_reference_id: orderId,
        metadata: { orderId },
        payment_intent_data: { metadata: { orderId } },
        success_url: `${CONSUMIDOR_URL}/pedido/${orderId}?paid=1`,
        cancel_url: `${CONSUMIDOR_URL}/checkout?cancelled=1`,
      })

      await orderRef.update({ 'payment.stripeSessionId': session.id ?? '' })

      return {
        orderId,
        checkoutUrl: session.url ?? '',
        total: totalInCents,
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err
      let errDetail: string
      try { errDetail = JSON.stringify(err) } catch { errDetail = String(err) }
      // Detalhe completo só no log do servidor — nunca devolvido ao cliente.
      console.error('createOrder erro não tratado:', errDetail)
      throw new HttpsError('internal', 'Erro interno ao criar o pedido. Tente novamente.')
    }
  },
)
