import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { MercadoPagoConfig, Payment as MPPayment, Preference } from 'mercadopago'

interface OrderItemInput {
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
  produtorId: string
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

      console.log('createOrder início — uid:', uid, 'produtorId:', data?.produtorId, 'paymentMethod:', data?.paymentMethod)

      if (!data.produtorId || !data.items?.length || !data.deliveryAddress || !data.paymentMethod) {
        throw new HttpsError('invalid-argument', 'Dados inválidos')
      }

      const db = admin.firestore()

      // 1. Valida produtor
      console.log('Etapa 1: validando produtor')
      const produtorSnap = await db.collection('produtores').doc(data.produtorId).get()
      if (!produtorSnap.exists) throw new HttpsError('not-found', 'Produtor não encontrado')
      const produtor = produtorSnap.data()!
      if (produtor['status'] !== 'approved') {
        throw new HttpsError('failed-precondition', 'Produtor não está ativo')
      }

      // 2. Valida itens e calcula subtotal
      console.log('Etapa 2: validando itens —', data.items.length, 'item(s)')
      let subtotalInCents = 0
      const orderItems: Record<string, unknown>[] = []

      for (const item of data.items) {
        const productSnap = await db
          .collection('produtores').doc(data.produtorId)
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
            .collection('produtores').doc(data.produtorId)
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

      const deliveryFeeInCents = (produtor['deliveryFeeInCents'] as number) ?? 0
      const minOrder = (produtor['minOrderValueInCents'] as number) ?? 0

      if (minOrder > 0 && subtotalInCents < minOrder) {
        throw new HttpsError(
          'failed-precondition',
          `Pedido mínimo: R$ ${(minOrder / 100).toFixed(2).replace('.', ',')}`,
        )
      }

      // 3. Valida e aplica cupom
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
          const produtorMatch = !c['produtorId'] || c['produtorId'] === data.produtorId
          const usesOk = !c['maxUses'] || (c['usedCount'] as number) < (c['maxUses'] as number)
          const minOk = !c['minOrderValueInCents'] || subtotalInCents >= (c['minOrderValueInCents'] as number)

          if (c['active'] && validFrom <= now && validUntil >= now && produtorMatch && usesOk && minOk) {
            couponCode = couponSnap.id
            if (c['type'] === 'percentage') {
              discountInCents = Math.floor(subtotalInCents * ((c['value'] as number) / 100))
            } else {
              discountInCents = c['value'] as number
            }
            if (c['maxDiscountInCents']) {
              discountInCents = Math.min(discountInCents, c['maxDiscountInCents'] as number)
            }
            discountInCents = Math.min(discountInCents, subtotalInCents)
            await couponSnap.ref.update({ usedCount: FieldValue.increment(1) })
          }
        }
      }

      const totalInCents = subtotalInCents + deliveryFeeInCents - discountInCents
      console.log('Total calculado (cents):', totalInCents)

      // 4. Dados do cliente
      console.log('Etapa 4: dados do cliente')
      const userSnap = await db.collection('users').doc(uid).get()
      const user = userSnap.data() ?? {}
      const customerName = (user['displayName'] as string) ?? (user['name'] as string) ?? ''
      const customerPhone = (user['phone'] as string) ?? ''

      // 5. Cria pedido
      console.log('Etapa 5: criando pedido no Firestore')
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

      await orderRef.set({
        customerId: uid,
        customerName,
        customerPhone,
        produtorId: data.produtorId,
        produtorName: produtor['name'],
        produtorSlug: produtor['slug'],
        items: orderItems,
        deliveryAddress: deliveryAddressClean,
        subtotalInCents,
        deliveryFeeInCents,
        discountInCents,
        totalInCents,
        ...(couponCode ? { couponCode } : {}),
        payment: { method: data.paymentMethod, status: 'pending' },
        status: 'pending',
        statusHistory: [{ status: 'pending', timestamp: tsNow }],
        estimatedDeliveryTimeMin: produtor['estimatedDeliveryTimeMin'] ?? 30,
        estimatedDeliveryTimeMax: produtor['estimatedDeliveryTimeMax'] ?? 60,
        createdAt: FieldValue.serverTimestamp(),
      })
      console.log('Pedido criado — orderId:', orderId)

      // 6. Integração Mercado Pago
      const mpToken = process.env['MERCADO_PAGO_ACCESS_TOKEN']
      const skipMp = process.env['SKIP_MP'] === 'true'

      if (!mpToken || skipMp) {
        return { orderId, paymentMethod: data.paymentMethod, total: totalInCents, devMode: true }
      }

      const client = new MercadoPagoConfig({ accessToken: mpToken })

      if (data.paymentMethod === 'pix') {
        console.log('Etapa 6: criando pagamento PIX')
        const paymentApi = new MPPayment(client)
        const payerEmail = (request.auth?.token?.email as string | undefined) ?? `${uid}@marketplace.app`
        const mpResult = await paymentApi.create({
          body: {
            transaction_amount: totalInCents / 100,
            description: `Pedido ${orderId.slice(0, 8)} - ${produtor['name']}`,
            payment_method_id: 'pix',
            payer: { email: payerEmail },
            external_reference: orderId,
            notification_url: WEBHOOK_URL,
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
        console.log('Etapa 6: criando preferência Checkout Pro')
        const prefApi = new Preference(client)
        const pref = await prefApi.create({
          body: {
            items: orderItems.map((it, idx) => ({
              id: String(idx + 1),
              title: it['productName'] as string,
              quantity: it['quantity'] as number,
              unit_price: (it['priceInCents'] as number) / 100,
              currency_id: 'BRL',
            })),
            external_reference: orderId,
            notification_url: WEBHOOK_URL,
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
      try {
        errDetail = JSON.stringify(err)
      } catch {
        errDetail = String(err)
      }
      console.error('createOrder erro não tratado:', errDetail)
      throw new HttpsError('internal', `Detalhe: ${errDetail}`)
    }
  },
)
