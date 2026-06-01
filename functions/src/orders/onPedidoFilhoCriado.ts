import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { sendPushToUser } from '../notifications/sendPush'

function centsToBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

/**
 * Notifica o produtor correto quando um pedido_filho é criado.
 * Substitui a notificação em onOrderCreated que usava apenas o primeiro produtor
 * do pedido pai — o que causava silêncio para todos os outros produtores da horta.
 */
export const onPedidoFilhoCriado = onDocumentCreated(
  { document: 'pedidos_filhos/{filhoId}', region: 'southamerica-east1' },
  async (event) => {
    const data = event.data?.data()
    if (!data) return

    const produtorId   = data['produtorId'] as string | undefined
    const pedidoPaiId  = data['pedidoPaiId'] as string | undefined
    const customerName = (data['customerName'] as string | undefined) ?? 'cliente'
    const items        = (data['items'] as Array<{ priceInCents: number; quantity: number }> | undefined) ?? []

    if (!produtorId || !pedidoPaiId) return

    const subtotalInCents = items.reduce((sum, it) => sum + it.priceInCents * it.quantity, 0)

    const db = admin.firestore()
    const produtorSnap = await db.collection('produtores').doc(produtorId).get()
    if (!produtorSnap.exists) return

    const ownerUid = produtorSnap.data()?.['ownerUid'] as string | undefined
    if (!ownerUid) return

    const msg = `Novo pedido de ${customerName} — ${centsToBrl(subtotalInCents)}`

    await db
      .collection('users')
      .doc(ownerUid)
      .collection('notifications')
      .add({
        type:      'new_order',
        orderId:   pedidoPaiId,
        status:    'pending',
        message:   msg,
        read:      false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      })

    await sendPushToUser(
      db,
      ownerUid,
      { title: 'Novo pedido! 🌿', body: msg },
    )

    console.log(`onPedidoFilhoCriado: filho ${event.params.filhoId} notificou produtor ${ownerUid}`)
  },
)
