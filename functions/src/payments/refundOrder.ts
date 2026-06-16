import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { MercadoPagoConfig, PaymentRefund } from 'mercadopago'

type FirestoreDb = FirebaseFirestore.Firestore

interface RefundResult {
  ok: boolean
  reason?: string
}

/**
 * Estorna o pagamento de um pedido no Mercado Pago e marca o pedido como
 * 'refunded'. Idempotente: se já estiver estornado ou não houver pagamento
 * aprovado, não faz nada.
 *
 * Modelo atual (plataforma recebe e repassa): o pagamento está na conta da
 * plataforma, então usa o token da plataforma. Se um dia houver split por
 * produtor, o estorno precisará usar o token do produtor (mp_tokens).
 */
async function processRefund(db: FirestoreDb, orderId: string): Promise<RefundResult> {
  const orderRef = db.collection('orders').doc(orderId)
  const snap = await orderRef.get()
  if (!snap.exists) return { ok: false, reason: 'order_not_found' }

  const order = snap.data()!
  const payment = (order['payment'] ?? {}) as Record<string, unknown>

  if (payment['status'] === 'refunded') return { ok: true, reason: 'already_refunded' }
  if (payment['status'] !== 'approved') return { ok: false, reason: 'not_paid' }

  const paymentId = (payment['mpPaymentId'] as string | undefined) ?? (payment['externalId'] as string | undefined)
  if (!paymentId) return { ok: false, reason: 'no_payment_id' }

  const token = process.env['MERCADO_PAGO_ACCESS_TOKEN']
  if (!token) return { ok: false, reason: 'mp_not_configured' }

  const client = new MercadoPagoConfig({ accessToken: token })
  // Refund total do pagamento
  await new PaymentRefund(client).create({ payment_id: Number(paymentId) })

  await orderRef.update({
    status: 'refunded',
    'payment.status': 'refunded',
    'payment.refundedAt': FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({ status: 'refunded', timestamp: Timestamp.now() }),
  })

  console.log(`processRefund: pedido ${orderId} estornado (payment ${paymentId})`)
  return { ok: true }
}

/**
 * Estorno manual disparado pelo admin (botão no backoffice).
 */
export const refundOrder = onCall(
  { region: 'southamerica-east1', secrets: ['MERCADO_PAGO_ACCESS_TOKEN'] },
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
      throw new HttpsError('internal', 'Não foi possível processar o estorno no Mercado Pago.')
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
  { document: 'orders/{orderId}', region: 'southamerica-east1', secrets: ['MERCADO_PAGO_ACCESS_TOKEN'] },
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
