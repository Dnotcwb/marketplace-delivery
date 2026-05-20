import * as admin from 'firebase-admin'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

const STATUS_MESSAGES: Record<string, string> = {
  confirmed:   'Pagamento confirmado! A horta está processando seu pedido.',
  accepted:    'A horta aceitou seu pedido e em breve começará o preparo.',
  preparing:   'Seu pedido está sendo preparado com carinho.',
  ready:       'Seu pedido está pronto e aguardando entrega.',
  on_delivery: 'Seu pedido saiu para entrega. Logo chegará!',
  delivered:   'Pedido entregue. Bom proveito! 🥦',
  cancelled:   'Seu pedido foi cancelado.',
  refunded:    'O pagamento do seu pedido foi estornado.',
}

export const onOrderStatusChanged = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data()
    const after  = event.data?.after.data()

    if (!before || !after) return
    if (before['status'] === after['status']) return

    const newStatus   = after['status'] as string
    const customerId  = after['customerId'] as string | undefined
    const orderId     = event.params.orderId
    const produtorName = after['produtorName'] as string | undefined

    if (!customerId) return

    const message = STATUS_MESSAGES[newStatus]
    if (!message) return

    const db = admin.firestore()

    await db
      .collection('users')
      .doc(customerId)
      .collection('notifications')
      .add({
        type: 'order_status',
        orderId,
        status: newStatus,
        produtorName: produtorName ?? '',
        message,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    console.log(`onOrderStatusChanged: pedido ${orderId} → ${newStatus}, cliente ${customerId}`)
  },
)
