import * as admin from 'firebase-admin'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

/**
 * Quando um PedidoFilho é marcado como 'separado', verifica se todos os
 * irmãos também foram separados. Se sim, promove o pedido pai para 'ready'
 * (pronto para coleta pelo entregador).
 */
export const onFilhoStatusChanged = onDocumentUpdated(
  { document: 'pedidos_filhos/{filhoId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data()
    const after  = event.data?.after.data()

    if (!before || !after) return
    if (before['status'] === after['status']) return
    if (after['status'] !== 'separado') return

    const pedidoPaiId = after['pedidoPaiId'] as string | undefined
    if (!pedidoPaiId) return

    const db = admin.firestore()

    // Busca todos os filhos deste pedido pai
    const filhosSnap = await db
      .collection('pedidos_filhos')
      .where('pedidoPaiId', '==', pedidoPaiId)
      .get()

    const allSeparados = filhosSnap.docs.every(
      (d) => d.data()['status'] === 'separado',
    )

    if (!allSeparados) {
      console.log(`onFilhoStatusChanged: pedido ${pedidoPaiId} ainda tem filhos pendentes`)
      return
    }

    // Todos separados → promove pedido pai para 'ready'
    const orderRef = db.collection('orders').doc(pedidoPaiId)
    const orderSnap = await orderRef.get()
    if (!orderSnap.exists) return

    const customerId   = orderSnap.data()!['customerId'] as string | undefined
    const produtorName = orderSnap.data()!['produtorName'] as string | undefined

    await orderRef.update({
      status: 'ready',
      statusHistory: admin.firestore.FieldValue.arrayUnion({
        status: 'ready',
        timestamp: admin.firestore.Timestamp.now(),
      }),
      readyAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`onFilhoStatusChanged: pedido ${pedidoPaiId} promovido para 'ready'`)

    // Notifica o cliente
    if (customerId) {
      await db
        .collection('users').doc(customerId)
        .collection('notifications').add({
          type:        'order_status',
          orderId:     pedidoPaiId,
          status:      'ready',
          produtorName: produtorName ?? '',
          message:     'Seu pedido está pronto e aguardando entrega.',
          read:        false,
          createdAt:   admin.firestore.FieldValue.serverTimestamp(),
        })
    }
  },
)
