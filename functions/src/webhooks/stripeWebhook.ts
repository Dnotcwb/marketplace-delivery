import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { onRequest } from 'firebase-functions/v2/https'
import {
  getStripe,
  type StripeClient,
  type StripeEvent,
  type StripePaymentIntent,
  type StripeAccount,
} from '../payments/stripeClient'

const REGION = 'southamerica-east1'

/**
 * Confirma o pedido e dispara o split: um transfer por pedido_filho, para a
 * conta Stripe do produtor, amarrado à cobrança (source_transaction) para que
 * os fundos fiquem disponíveis na hora. Idempotente.
 */
async function confirmAndSplit(
  db: FirebaseFirestore.Firestore,
  stripe: StripeClient,
  orderId: string,
  paymentIntent: StripePaymentIntent,
): Promise<void> {
  const orderRef = db.collection('orders').doc(orderId)
  const orderSnap = await orderRef.get()
  if (!orderSnap.exists) {
    console.warn('stripeWebhook: pedido não encontrado', orderId)
    return
  }
  const order = orderSnap.data()!
  const lc = paymentIntent.latest_charge
  const charge = typeof lc === 'object' && lc !== null ? lc : undefined
  const chargeId = typeof lc === 'string' ? lc : charge?.id

  // 1. Confirma o pedido (idempotente).
  if ((order['payment'] as Record<string, unknown> | undefined)?.['status'] !== 'approved') {
    const tsNow = Timestamp.now()
    // Método efetivamente usado (card/pix), quando disponível.
    const usedType = charge?.payment_method_details?.type
    const method = usedType === 'pix' ? 'pix' : usedType === 'card' ? 'credit_card' : undefined

    await orderRef.update({
      status: 'confirmed',
      'payment.status': 'approved',
      'payment.stripePaymentIntentId': paymentIntent.id,
      ...(chargeId ? { 'payment.stripeChargeId': chargeId } : {}),
      ...(method ? { 'payment.method': method } : {}),
      'payment.paidAt': FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({ status: 'confirmed', timestamp: tsNow }),
      confirmedAt: FieldValue.serverTimestamp(),
    })
    console.log('stripeWebhook: pedido confirmado', orderId)
  }

  // 2. Cria os transfers para cada produtor (idempotente por filho).
  if (!chargeId) {
    console.error('stripeWebhook: sem chargeId — não é possível fazer transfers', orderId)
    return
  }

  const filhosSnap = await db
    .collection('pedidos_filhos')
    .where('pedidoPaiId', '==', orderId)
    .get()

  for (const filhoDoc of filhosSnap.docs) {
    const filho = filhoDoc.data()
    if (filho['transferId']) continue // já transferido
    const destination = filho['stripeAccountId'] as string | undefined
    const amount = filho['valorRepasseInCents'] as number | undefined
    if (!destination || !amount || amount <= 0) {
      console.warn('stripeWebhook: filho sem destino/valor válido', filhoDoc.id)
      continue
    }
    try {
      const transfer = await stripe.transfers.create({
        amount,
        currency: 'brl',
        destination,
        source_transaction: chargeId,
        description: `Repasse pedido ${orderId.slice(0, 8)} - ${filho['produtorName'] ?? ''}`,
        metadata: { orderId, pedidoFilhoId: filhoDoc.id },
      })
      await filhoDoc.ref.update({
        transferId: transfer.id,
        repassePago: true,
        repassePagoAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      console.log(`stripeWebhook: transfer ${transfer.id} → ${destination} (${amount})`)
    } catch (err) {
      // Não relança: outros filhos ainda devem ser processados. O transfer
      // pode ser refeito num reenvio do webhook (idempotente por transferId).
      console.error('stripeWebhook: falha no transfer do filho', filhoDoc.id, err)
    }
  }
}

export const stripeWebhook = onRequest(
  { region: REGION, secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  async (req, res) => {
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET']
    if (!webhookSecret) {
      res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET não configurado' })
      return
    }

    const stripe = getStripe()
    const sig = req.headers['stripe-signature'] as string | undefined
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature' })
      return
    }

    let event: StripeEvent
    try {
      // rawBody é fornecido pelo Firebase Functions e é necessário para validar a assinatura.
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret)
    } catch (err) {
      console.error('stripeWebhook: assinatura inválida', err)
      res.status(400).json({ error: 'Invalid signature' })
      return
    }

    const db = admin.firestore()

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as StripePaymentIntent
          const orderId = pi.metadata?.['orderId']
          if (!orderId) {
            console.warn('stripeWebhook: payment_intent.succeeded sem orderId no metadata', pi.id)
            break
          }
          // Reconsulta com expand para garantir latest_charge completo.
          const full = await stripe.paymentIntents.retrieve(pi.id, {
            expand: ['latest_charge'],
          })
          await confirmAndSplit(db, stripe, orderId, full)
          break
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object as StripePaymentIntent
          const orderId = pi.metadata?.['orderId']
          if (orderId) {
            const orderRef = db.collection('orders').doc(orderId)
            const snap = await orderRef.get()
            if (snap.exists && snap.data()!['status'] === 'pending') {
              await orderRef.update({
                status: 'cancelled',
                'payment.status': 'rejected',
                statusHistory: FieldValue.arrayUnion({
                  status: 'cancelled',
                  timestamp: Timestamp.now(),
                }),
                cancelledAt: FieldValue.serverTimestamp(),
              })
            }
          }
          break
        }

        case 'account.updated': {
          const account = event.data.object as StripeAccount
          const onboarded = account.capabilities?.transfers === 'active'
          const q = await db
            .collection('produtores')
            .where('stripeAccountId', '==', account.id)
            .limit(1)
            .get()
          if (!q.empty) {
            await q.docs[0]!.ref.update({
              stripeOnboarded: onboarded,
              updatedAt: FieldValue.serverTimestamp(),
            })
            console.log(`stripeWebhook: produtor ${q.docs[0]!.id} stripeOnboarded=${onboarded}`)
          }
          break
        }

        default:
          // Ignora eventos não tratados.
          break
      }
    } catch (err) {
      console.error('stripeWebhook: erro ao processar evento', event.type, err)
      res.status(500).json({ error: 'processing_error' })
      return
    }

    res.json({ received: true })
  },
)
