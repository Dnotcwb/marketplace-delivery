import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { sendPushToUser } from '../notifications/sendPush'

function centsToBrl(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

/**
 * Notifica o produtor sempre que um novo pedido é criado.
 * Escreve em users/{ownerUid}/notifications para que o NotificationBell
 * do app do produtor receba o evento em tempo real.
 */
export const onOrderCreated = onDocumentCreated(
  { document: 'orders/{orderId}', region: 'southamerica-east1' },
  async (event) => {
    const data = event.data?.data()
    if (!data) return

    const orderId      = event.params.orderId
    const produtorId   = data['produtorId'] as string | undefined
    const customerName = (data['customerName'] as string | undefined) ?? 'cliente'
    const totalInCents = data['totalInCents'] as number | undefined

    if (!produtorId || !totalInCents) return

    const db = admin.firestore()

    const produtorSnap = await db.collection('produtores').doc(produtorId).get()
    if (!produtorSnap.exists) return

    const ownerUid = produtorSnap.data()?.['ownerUid'] as string | undefined
    if (!ownerUid) return

    const msg = `Novo pedido de ${customerName} — ${centsToBrl(totalInCents)}`

    await db
      .collection('users')
      .doc(ownerUid)
      .collection('notifications')
      .add({
        type:      'new_order',
        orderId,
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

    console.log(`onOrderCreated: pedido ${orderId} notificou produtor ${ownerUid}`)
  },
)
