import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { MercadoPagoConfig, Payment as MPPayment, Preference } from 'mercadopago'

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

const WEBHOOK_URL =
  'https://southamerica-east1-marketplace-delivery-dev.cloudfunctions.net/mercadoPagoWebhook'

export const createOrder = onCall(
  { region: 'southamerica-east1', secrets: ['MERCADO_PAGO_ACCESS_TOKEN'] },
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

      const db = admin.firestore()

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
      // Map: produtorId → { produtorData, orderItems, subtotal }
      const produtorGroups = new Map<string, {
        produtorData: FirebaseFirestore.DocumentData
        orderItems: Record<string, unknown>[]
        subtotalInCents: number
      }>()

      for (const [produtorId, prodItems] of itemsByProdutor) {
        const produtorSnap = await db.collection('produtores').doc(produtorId).get()
        if (!produtorSnap.exists) {
          throw new HttpsError('not-found', `Produtor ${produtorId} não encontrado`)
        }
        const produtorData = produtorSnap.data()!
        if (produtorData['status'] !== 'approved') {
          throw new HttpsError('failed-precondition', `Produtor ${produtorData['name']} não está ativo`)
        }
        // Confere que este produtor pertence à horta
        const hortaIdDoProd = produtorData['hortaId'] as string | undefined
        if (hortaIdDoProd && hortaIdDoProd !== data.hortaId) {
          throw new HttpsError('failed-precondition', `Produtor ${produtorData['name']} não pertence a esta horta`)
        }

        let subtotalInCents = 0
        const orderItems: Record<string, unknown>[] = []

        for (const item of prodItems) {
          const productSnap = await db
            .collection('produtores').doc(produtorId)
            .collection('products').doc(item.productId)
            .get()
          if (!productSnap.exists) {
            throw new HttpsError('not-found', `Produto ${item.productId} não encontrado`)
          }
          const product = productSnap.data()!
          if (!product['available']) {
            throw new HttpsError('failed-precondition', `${product['name']} está indisponível`)
          }

          let categoryName = ''
          if (product['categoryId']) {
            const catSnap = await db
              .collection('produtores').doc(produtorId)
              .collection('categories').doc(product['categoryId'])
              .get()
            if (catSnap.exists) categoryName = (catSnap.data()!['name'] as string) ?? ''
          }

          subtotalInCents += (product['priceInCents'] as number) * item.quantity
          orderItems.push({
            productId: item.productId,
            productName: product['name'],
            categoryId: product['categoryId'] ?? '',
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

      const deliveryFeeInCents = (horta['deliveryFeeInCents'] as number) ?? 0
      const minOrder = (horta['minOrderValueInCents'] as number) ?? 0

      if (minOrder > 0 && subtotalGlobalInCents < minOrder) {
        throw new HttpsError(
          'failed-precondition',
          `Pedido mínimo: R$ ${(minOrder / 100).toFixed(2).replace('.', ',')}`,
        )
      }

      // 3. Cupom (aplicado ao total global)
      console.log('Etapa 3: cupom —', data.couponCode ?? 'nenhum')
      let discountInCents = 0
      let couponCode: string | undefined

      if (data.couponCode) {
        const couponSnap = await db.collection('coupons').doc(data.couponCode.toUpperCase()).get()
        if (couponSnap.exists) {
          const c = couponSnap.data()!
          const now = new Date()
          const validFrom = c['validFrom'].toDate() as Date
          const validUntil = c['validUntil'].toDate() as Date
          const usesOk = !c['maxUses'] || (c['usedCount'] as number) < (c['maxUses'] as number)
          const minOk = !c['minOrderValueInCents'] || subtotalGlobalInCents >= (c['minOrderValueInCents'] as number)

          if (c['active'] && validFrom <= now && validUntil >= now && usesOk && minOk) {
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
            await couponSnap.ref.update({ usedCount: FieldValue.increment(1) })
          }
        }
      }

      const totalInCents = subtotalGlobalInCents + deliveryFeeInCents - discountInCents
      console.log('Total calculado (cents):', totalInCents)

      // 4. Dados do cliente
      console.log('Etapa 4: dados do cliente')
      const userSnap = await db.collection('users').doc(uid).get()
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
      const commission = (horta['commission'] as number) ?? 0.10

      const filhoBatch = db.batch()
      for (const [produtorId, group] of produtorGroups) {
        const valorRepasse = Math.round(group.subtotalInCents * (1 - commission))
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
          items: group.orderItems,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })
      }
      await filhoBatch.commit()
      console.log('Pedidos filhos criados')

      // 7. Integração Mercado Pago
      const platformToken = process.env['MERCADO_PAGO_ACCESS_TOKEN']
      const skipMp = process.env['SKIP_MP'] === 'true'

      if (!platformToken || skipMp) {
        return { orderId, paymentMethod: data.paymentMethod, total: totalInCents, devMode: true }
      }

      // Split direto ao produtor quando:
      // (a) pedido de produtor único E
      // (b) produtor tem token MP cadastrado E
      // (c) plataforma tem MP_CLIENT_ID (app Marketplace configurado)
      let mpToken = platformToken
      let marketplaceFeeAmount: number | undefined
      const mpClientId = process.env['MP_CLIENT_ID']

      if (produtorGroups.size === 1 && mpClientId) {
        const singleProdutorId = [...produtorGroups.keys()][0]!
        const mpTokenSnap = await db.collection('mp_tokens').doc(singleProdutorId).get()
        const producerToken = mpTokenSnap.data()?.['accessToken'] as string | undefined
        if (producerToken) {
          mpToken = producerToken
          const commission = (horta['commission'] as number) ?? 0.10
          marketplaceFeeAmount = Math.round(totalInCents * commission) / 100
          console.log('Usando token do produtor — split direto, taxa plataforma:', marketplaceFeeAmount)
        }
      }

      const client = new MercadoPagoConfig({ accessToken: mpToken })

      if (data.paymentMethod === 'pix') {
        console.log('Etapa 7: criando pagamento PIX')
        const paymentApi = new MPPayment(client)
        const payerEmail = (request.auth?.token?.email as string | undefined) ?? `${uid}@marketplace.app`
        const mpResult = await paymentApi.create({
          body: {
            transaction_amount: totalInCents / 100,
            description: `Pedido ${orderId.slice(0, 8)} - ${horta['name']}`,
            payment_method_id: 'pix',
            payer: { email: payerEmail },
            external_reference: orderId,
            notification_url: WEBHOOK_URL,
            ...(marketplaceFeeAmount !== undefined && { marketplace_fee: marketplaceFeeAmount }),
          },
        })

        console.log('PIX criado — MP id:', mpResult.id, 'status:', mpResult.status)
        const txData = mpResult.point_of_interaction?.transaction_data
        await orderRef.update({
          'payment.externalId': String(mpResult.id),
          'payment.pixQrCode': txData?.qr_code ?? '',
          'payment.pixQrCodeBase64': txData?.qr_code_base64 ?? '',
        })

        return {
          orderId,
          paymentMethod: 'pix',
          pixQrCode: txData?.qr_code ?? '',
          pixQrCodeBase64: txData?.qr_code_base64 ?? '',
          total: totalInCents,
        }
      } else {
        console.log('Etapa 7: criando preferência Checkout Pro')
        const allItems = [...produtorGroups.values()].flatMap((g) => g.orderItems)
        const prefApi = new Preference(client)
        const pref = await prefApi.create({
          body: {
            items: allItems.map((it, idx) => ({
              id: String(idx + 1),
              title: it['productName'] as string,
              quantity: it['quantity'] as number,
              unit_price: (it['priceInCents'] as number) / 100,
              currency_id: 'BRL',
            })),
            external_reference: orderId,
            notification_url: WEBHOOK_URL,
            ...(marketplaceFeeAmount !== undefined && { marketplace_fee: marketplaceFeeAmount }),
            back_urls: {
              success: `https://consumidor.netlify.app/pedido/${orderId}`,
              failure: `https://consumidor.netlify.app/checkout`,
              pending: `https://consumidor.netlify.app/pedido/${orderId}`,
            },
            auto_return: 'approved',
          },
        })

        await orderRef.update({ 'payment.externalId': pref.id ?? '' })

        return {
          orderId,
          paymentMethod: 'credit_card',
          mpPreferenceUrl: pref.sandbox_init_point ?? pref.init_point ?? '',
          total: totalInCents,
        }
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err
      let errDetail: string
      try { errDetail = JSON.stringify(err) } catch { errDetail = String(err) }
      console.error('createOrder erro não tratado:', errDetail)
      throw new HttpsError('internal', `Detalhe: ${errDetail}`)
    }
  },
)
