import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { getStripe } from './stripeClient'

const REGION = 'southamerica-east1'

type FirestoreDb = FirebaseFirestore.Firestore

interface RefundResult {
  ok: boolean
  reason?: string
}

/**
 * Estorna o pagamento de um pedido no Stripe e marca o pedido como 'refunded'.
 * Idempotente: se já estiver estornado ou não houver pagamento aprovado, não faz nada.
 *
 * Como o modelo é "separate charges and transfers", primeiro revertemos os
 * transfers feitos aos produtores (puxando o dinheiro de volta) e depois
 * reembolsamos o consumidor pelo PaymentIntent.
 */
async function processRefund(db: FirestoreDb, orderId: string): Promise<RefundResult> {
  const orderRef = db.collection('orders').doc(orderId)
  const snap = await orderRef.get()
  if (!snap.exists) return { ok: false, reason: 'order_not_found' }

  const order = snap.data()!
  const payment = (order['payment'] ?? {}) as Record<string, unknown>

  if (payment['status'] === 'refunded') return { ok: true, reason: 'already_refunded' }
  if (payment['status'] !== 'approved') return { ok: false, reason: 'not_paid' }

  const paymentIntentId = payment['stripePaymentIntentId'] as string | undefined
  if (!paymentIntentId) return { ok: false, reason: 'no_payment_intent' }

  const stripe = getStripe()

  // 1. Reverte os transfers de cada produtor (devolve o repasse à plataforma).
  const filhosSnap = await db
    .collection('pedidos_filhos')
    .where('pedidoPaiId', '==', orderId)
    .get()

  for (const filhoDoc of filhosSnap.docs) {
    const filho = filhoDoc.data()
    const transferId = filho['transferId'] as string | undefined
    if (!transferId) continue
    try {
      await stripe.transfers.createReversal(transferId, {
        metadata: { orderId, pedidoFilhoId: filhoDoc.id, reason: 'refund' },
      })
      await filhoDoc.ref.update({
        repassePago: false,
        updatedAt: FieldValue.serverTimestamp(),
      })
    } catch (err) {
      console.error('processRefund: falha ao reverter transfer', transferId, err)
      // Continua: o reembolso ao cliente ainda deve ser tentado.
    }
  }

  // 2. Reembolsa o consumidor.
  await stripe.refunds.create({ payment_intent: paymentIntentId })

  await orderRef.update({
    status: 'refunded',
    'payment.status': 'refunded',
    'payment.refundedAt': FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({ status: 'refunded', timestamp: Timestamp.now() }),
  })

  console.log(`processRefund: pedido ${orderId} estornado (PaymentIntent ${paymentIntentId})`)
  return { ok: true }
}

/**
 * Estorno manual disparado pelo admin (botão no backoffice).
 */
export const refundOrder = onCall(
  { region: REGION, secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem estornar.')
    }
    const orderId = (request.data as { orderId?: string })?.orderId
    if (!orderId) throw new HttpsError('invalid-argument', 'orderId é obrigatório.')

    let result: RefundResult
    try {
      result = await processRefund(admin.firestore(), orderId)
    } catch (err) {
      console.error('refundOrder: falha no estorno do pedido', orderId, err)
      throw new HttpsError('internal', 'Não foi possível processar o estorno no Stripe.')
    }

    if (!result.ok && result.reason === 'not_paid') {
      throw new HttpsError('failed-precondition', 'Este pedido não tem pagamento aprovado para estornar.')
    }
    if (!result.ok) {
      throw new HttpsError('failed-precondition', `Estorno não realizado (${result.reason}).`)
    }

    await admin.firestore().collection('auditLogs').add({
      adminUid: request.auth.uid,
      adminEmail: request.auth.token['email'] ?? '',
      action: 'order.refund',
      targetType: 'order',
      targetId: orderId,
      timestamp: FieldValue.serverTimestamp(),
    })

    return result
  },
)

/**
 * Estorno automático: quando um pedido PAGO é cancelado, devolve o dinheiro.
 * Cobre tanto o cancelamento pelo admin quanto o cancelamento propagado pelos
 * pedidos filhos (onFilhoStatusChanged).
 */
export const onOrderRefundOnCancel = onDocumentUpdated(
  { document: 'orders/{orderId}', region: REGION, secrets: ['STRIPE_SECRET_KEY'] },
  async (event) => {
    const before = event.data?.before.data()
    const after = event.data?.after.data()
    if (!before || !after) return

    const becameCancelled = before['status'] !== 'cancelled' && after['status'] === 'cancelled'
    const paid = (after['payment'] as Record<string, unknown> | undefined)?.['status'] === 'approved'
    if (!becameCancelled || !paid) return

    try {
      await processRefund(admin.firestore(), event.params.orderId)
    } catch (err) {
      // Não relança — o estorno pode ser refeito manualmente pelo admin.
      console.error('onOrderRefundOnCancel: falha ao estornar', event.params.orderId, err)
    }
  },
)
