import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import * as crypto from 'crypto'

export const mercadoPagoWebhook = onRequest(
  { region: 'southamerica-east1', secrets: ['MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET'] },
  async (req, res) => {
    // Verifica assinatura HMAC (quando configurada).
    // Com o secret configurado, requisições SEM assinatura são rejeitadas —
    // aceitar o evento sem validar abriria caminho para webhooks forjados.
    const webhookSecret = process.env['MERCADO_PAGO_WEBHOOK_SECRET']
    if (webhookSecret) {
      const xSignature = req.headers['x-signature'] as string | undefined
      const xRequestId = req.headers['x-request-id'] as string | undefined

      if (!xSignature || !xRequestId) {
        res.status(400).json({ error: 'Missing signature headers' })
        return
      }

      const dataId = (req.query['data.id'] as string) ?? (req.body?.data?.id as string)
      const parts = xSignature.split(',')
      let ts = ''
      let hash = ''
      for (const part of parts) {
        const [key, value] = part.trim().split('=')
        if (key === 'ts') ts = value ?? ''
        if (key === 'v1') hash = value ?? ''
      }
      const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
      const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest('hex')
      if (expected !== hash) {
        res.status(400).json({ error: 'Invalid signature' })
        return
      }
    }

    // Só processa eventos de pagamento
    const topic = (req.body?.type as string) ?? (req.query['topic'] as string)
    if (topic !== 'payment') {
      res.json({ ok: true })
      return
    }

    const paymentId =
      (req.body?.data?.id as string) ??
      (req.query['id'] as string) ??
      (req.query['data.id'] as string)

    if (!paymentId) {
      res.status(400).json({ error: 'Missing payment id' })
      return
    }

    const mpToken = process.env['MERCADO_PAGO_ACCESS_TOKEN']
    if (!mpToken) {
      res.status(500).json({ error: 'MP not configured' })
      return
    }

    try {
      const db = admin.firestore()
      const client = new MercadoPagoConfig({ accessToken: mpToken })
      const paymentApi = new Payment(client)

      // Pagamentos de split direto são criados com o token DO PRODUTOR e não
      // existem na conta da plataforma. Se a consulta com o token da plataforma
      // falhar, localiza o pedido pelo externalId e reconsulta com o token
      // do produtor (mp_tokens/{produtorId}).
      let mpPayment
      try {
        mpPayment = await paymentApi.get({ id: String(paymentId) })
      } catch (platformErr) {
        const orderQuery = await db
          .collection('orders')
          .where('payment.externalId', '==', String(paymentId))
          .limit(1)
          .get()
        if (orderQuery.empty) throw platformErr

        const produtorId = orderQuery.docs[0]!.data()['produtorId'] as string | undefined
        const tokenSnap = produtorId
          ? await db.collection('mp_tokens').doc(produtorId).get()
          : null
        const producerToken = tokenSnap?.data()?.['accessToken'] as string | undefined
        if (!producerToken) throw platformErr

        const producerClient = new MercadoPagoConfig({ accessToken: producerToken })
        mpPayment = await new Payment(producerClient).get({ id: String(paymentId) })
        console.log(`Webhook: pagamento ${paymentId} resolvido com token do produtor ${produtorId}`)
      }

      const orderId = mpPayment.external_reference
      if (!orderId) {
        res.json({ ok: true })
        return
      }

      const orderRef = db.collection('orders').doc(orderId)
      const orderSnap = await orderRef.get()
      if (!orderSnap.exists) {
        res.json({ ok: true })
        return
      }

      const mpStatus = mpPayment.status
      const tsNow = Timestamp.now()

      if (mpStatus === 'approved') {
        await orderRef.update({
          status: 'confirmed',
          'payment.status': 'approved',
          // ID real do pagamento — necessário para estornar depois (no cartão,
          // externalId é o id da preference, não do pagamento).
          'payment.mpPaymentId': String(mpPayment.id),
          'payment.paidAt': FieldValue.serverTimestamp(),
          statusHistory: FieldValue.arrayUnion({ status: 'confirmed', timestamp: tsNow }),
          confirmedAt: FieldValue.serverTimestamp(),
        })
      } else if (mpStatus === 'rejected' || mpStatus === 'cancelled') {
        await orderRef.update({
          status: 'cancelled',
          'payment.status': mpStatus === 'rejected' ? 'rejected' : 'cancelled',
          statusHistory: FieldValue.arrayUnion({ status: 'cancelled', timestamp: tsNow }),
          cancelledAt: FieldValue.serverTimestamp(),
        })
      }

      res.json({ ok: true })
    } catch (err) {
      console.error('Webhook error:', err)
      res.status(500).json({ error: 'Internal error' })
    }
  },
)
