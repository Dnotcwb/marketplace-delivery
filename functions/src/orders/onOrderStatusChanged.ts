import * as admin from 'firebase-admin'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { sendPushToUser } from '../notifications/sendPush'

// Mensagens enviadas ao cliente quando o status do pedido muda
const CUSTOMER_MESSAGES: Record<string, string> = {
  confirmed:   'Pagamento confirmado! A horta está processando seu pedido.',
  accepted:    'A horta aceitou seu pedido e em breve começará o preparo.',
  preparing:   'Seu pedido está sendo preparado com carinho.',
  ready:       'Seu pedido está pronto e aguardando retirada pelo entregador.',
  on_delivery: 'Seu pedido foi retirado e está a caminho!',
  delivered:   'Pedido entregue. Bom proveito! 🥦',
  cancelled:   'Seu pedido foi cancelado.',
  refunded:    'O pagamento do seu pedido foi estornado.',
}

// Mensagens enviadas ao produtor quando o status muda por ação externa
const PRODUTOR_MESSAGES: Record<string, string> = {
  cancelled:   'Pedido cancelado.',
  delivered:   'Pedido entregue com sucesso.',
  on_delivery: 'Entregador a caminho do cliente.',
}

// Títulos FCM para push ao consumidor
const CUSTOMER_PUSH_TITLES: Record<string, string> = {
  confirmed:   'Pedido confirmado ✅',
  preparing:   'Preparando seu pedido 👩‍🍳',
  ready:       'Pedido pronto! 📦',
  on_delivery: 'Saiu para entrega! 🛵',
  delivered:   'Pedido entregue! 🎉',
  cancelled:   'Pedido cancelado',
  refunded:    'Reembolso processado',
}

export const onOrderStatusChanged = onDocumentUpdated(
  { document: 'orders/{orderId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data()
    const after  = event.data?.after.data()

    if (!before || !after) return
    if (before['status'] === after['status']) return

    const newStatus    = after['status'] as string
    const customerId   = after['customerId'] as string | undefined
    const produtorId   = after['produtorId'] as string | undefined
    const orderId      = event.params.orderId
    const produtorName = after['produtorName'] as string | undefined
    const customerName = (after['customerName'] as string | undefined) ?? 'cliente'

    const db = admin.firestore()
    const tasks: Promise<unknown>[] = []

    // ── Notificação para o cliente ──────────────────────────────
    const customerMsg = CUSTOMER_MESSAGES[newStatus]
    if (customerId && customerMsg) {
      tasks.push(
        db.collection('users').doc(customerId).collection('notifications').add({
          type:        'order_status',
          orderId,
          status:      newStatus,
          produtorName: produtorName ?? '',
          message:     customerMsg,
          read:        false,
          createdAt:   admin.firestore.FieldValue.serverTimestamp(),
        }),
      )

      const pushTitle = CUSTOMER_PUSH_TITLES[newStatus]
      if (pushTitle) {
        tasks.push(
          sendPushToUser(db, customerId, { title: pushTitle, body: customerMsg }, {
            url: `/pedido/${orderId}`,
          }),
        )
      }
    }

    // ── Notificação para o produtor ─────────────────────────────
    const produtorMsg = PRODUTOR_MESSAGES[newStatus]
    let ownerUid: string | undefined
    if (produtorId && produtorMsg) {
      const produtorSnap = await db.collection('produtores').doc(produtorId).get()
      ownerUid = produtorSnap.data()?.['ownerUid'] as string | undefined
      if (ownerUid) {
        const fullMsg = `${produtorMsg} Pedido de ${customerName} (#${orderId.slice(0, 8).toUpperCase()})`
        tasks.push(
          db.collection('users').doc(ownerUid).collection('notifications').add({
            type:      'order_status',
            orderId,
            status:    newStatus,
            message:   fullMsg,
            read:      false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
        )
        tasks.push(
          sendPushToUser(db, ownerUid, { title: 'Atualização de pedido', body: fullMsg }),
        )
      }
    }

    // ── Propagar status para pedidos_filhos ────────────────────
    // on_delivery → retirado | delivered → entregue
    const filhoStatusMap: Record<string, string> = {
      on_delivery: 'retirado',
      delivered:   'entregue',
    }
    const filhoStatus = filhoStatusMap[newStatus]
    if (filhoStatus) {
      const filhosSnap = await db
        .collection('pedidos_filhos')
        .where('pedidoPaiId', '==', orderId)
        .get()

      if (!filhosSnap.empty) {
        const batch = db.batch()
        for (const filhoDoc of filhosSnap.docs) {
          batch.update(filhoDoc.ref, {
            status: filhoStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
        }
        tasks.push(batch.commit())
        console.log(
          `onOrderStatusChanged: propagando ${filhoStatus} para ${filhosSnap.size} pedido(s) filho(s)`,
        )
      }
    }

    await Promise.all(tasks)
    console.log(`onOrderStatusChanged: pedido ${orderId} → ${newStatus}`)
  },
)
