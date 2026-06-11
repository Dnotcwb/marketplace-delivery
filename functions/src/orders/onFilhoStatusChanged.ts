import * as admin from 'firebase-admin'
import { onDocumentUpdated } from 'firebase-functions/v2/firestore'

/**
 * Reage a mudanças de status em pedidos_filhos:
 *
 * - 'separado': se todos os irmãos também separaram → promove pedido pai para 'ready'
 * - 'retirado': propaga 'retirado' a todos os irmãos via admin SDK (sem restrição
 *   de regras) e promove pedido pai para 'on_delivery'
 */
export const onFilhoStatusChanged = onDocumentUpdated(
  { document: 'pedidos_filhos/{filhoId}', region: 'southamerica-east1' },
  async (event) => {
    const before = event.data?.before.data()
    const after  = event.data?.after.data()

    if (!before || !after) return
    if (before['status'] === after['status']) return

    const newStatus   = after['status'] as string
    const pedidoPaiId = after['pedidoPaiId'] as string | undefined
    if (!pedidoPaiId) return

    const db = admin.firestore()

    // ── Todos separados → pedido pai 'ready' ────────────────────
    if (newStatus === 'separado') {
      const filhosSnap = await db
        .collection('pedidos_filhos')
        .where('pedidoPaiId', '==', pedidoPaiId)
        .get()

      const allSeparados = filhosSnap.docs.every(
        (d) => ['separado', 'cancelado'].includes(d.data()['status'] as string),
      )

      if (!allSeparados) {
        console.log(`onFilhoStatusChanged: pedido ${pedidoPaiId} aguardando demais filhos`)
        return
      }

      const orderRef  = db.collection('orders').doc(pedidoPaiId)
      const orderSnap = await orderRef.get()
      if (!orderSnap.exists) return

      const currentStatus = orderSnap.data()!['status'] as string
      if (currentStatus === 'ready') return  // já promovido

      await orderRef.update({
        status: 'ready',
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: 'ready',
          timestamp: admin.firestore.Timestamp.now(),
        }),
        readyAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`onFilhoStatusChanged: pedido ${pedidoPaiId} → 'ready'`)
      return
    }

    // ── Todos cancelados → pedido pai 'cancelled' ───────────────
    // O estorno do pagamento NÃO é automático — fica a cargo do admin
    // (não há refund via API do MP implementado).
    if (newStatus === 'cancelado') {
      const filhosSnap = await db
        .collection('pedidos_filhos')
        .where('pedidoPaiId', '==', pedidoPaiId)
        .get()

      const allCancelados = filhosSnap.docs.every(
        (d) => d.data()['status'] === 'cancelado',
      )
      if (!allCancelados) return

      const orderRef  = db.collection('orders').doc(pedidoPaiId)
      const orderSnap = await orderRef.get()
      if (!orderSnap.exists) return

      const currentStatus = orderSnap.data()!['status'] as string
      if (['cancelled', 'delivered', 'refunded'].includes(currentStatus)) return

      await orderRef.update({
        status: 'cancelled',
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: 'cancelled',
          timestamp: admin.firestore.Timestamp.now(),
        }),
        cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`onFilhoStatusChanged: todos os filhos cancelados — pedido ${pedidoPaiId} → 'cancelled'`)
      return
    }

    // ── Qualquer produtor marca 'retirado' → propaga a todos ────
    if (newStatus === 'retirado') {
      const filhosSnap = await db
        .collection('pedidos_filhos')
        .where('pedidoPaiId', '==', pedidoPaiId)
        .get()

      const batch = db.batch()
      let propagated = 0
      for (const filhoDoc of filhosSnap.docs) {
        const s = filhoDoc.data()['status'] as string
        if (s !== 'retirado' && s !== 'cancelado' && s !== 'entregue') {
          batch.update(filhoDoc.ref, {
            status: 'retirado',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          })
          propagated++
        }
      }
      if (propagated > 0) {
        await batch.commit()
        console.log(`onFilhoStatusChanged: propagou 'retirado' para ${propagated} irmão(s) — pedido ${pedidoPaiId}`)
      }

      // Promove pedido pai para 'on_delivery' (dispara notificação ao cliente via onOrderStatusChanged)
      const orderRef  = db.collection('orders').doc(pedidoPaiId)
      const orderSnap = await orderRef.get()
      if (!orderSnap.exists) return

      const currentStatus = orderSnap.data()!['status'] as string
      if (currentStatus === 'on_delivery' || currentStatus === 'delivered') return

      await orderRef.update({
        status: 'on_delivery',
        statusHistory: admin.firestore.FieldValue.arrayUnion({
          status: 'on_delivery',
          timestamp: admin.firestore.Timestamp.now(),
        }),
        onDeliveryAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log(`onFilhoStatusChanged: pedido ${pedidoPaiId} → 'on_delivery'`)
    }
  },
)
