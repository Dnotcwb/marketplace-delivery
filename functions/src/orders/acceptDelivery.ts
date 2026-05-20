import * as admin from 'firebase-admin'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

export const acceptDelivery = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Usuário não autenticado')
    }

    const role = request.auth.token['role']
    if (role !== 'entregador') {
      throw new HttpsError('permission-denied', 'Somente entregadores podem aceitar pedidos')
    }

    const { orderId } = request.data as { orderId?: string }
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'orderId é obrigatório')
    }

    const db = admin.firestore()
    const orderRef = db.collection('orders').doc(orderId)

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef)

      if (!snap.exists) {
        throw new HttpsError('not-found', 'Pedido não encontrado')
      }

      const data = snap.data()!

      if (data['status'] !== 'ready') {
        throw new HttpsError('failed-precondition', 'Pedido não está disponível para entrega')
      }

      if (data['deliveryDriverId']) {
        throw new HttpsError('already-exists', 'Este pedido já foi aceito por outro entregador')
      }

      const now = Timestamp.now()

      tx.update(orderRef, {
        deliveryDriverId: request.auth!.uid,
        status: 'on_delivery',
        onDeliveryAt: now,
        statusHistory: FieldValue.arrayUnion({ status: 'on_delivery', timestamp: now }),
      })
    })

    console.log(`acceptDelivery: pedido ${orderId} aceito pelo entregador ${request.auth.uid}`)
    return { success: true }
  },
)
