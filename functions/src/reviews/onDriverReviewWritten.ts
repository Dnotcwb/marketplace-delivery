import * as admin from 'firebase-admin'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

/**
 * Mantém deliveryDrivers/{uid}.ratingAvg e ratingCount sempre que uma review de
 * entregador é criada, removida (soft delete) ou alterada.
 */
export const onDriverReviewWritten = onDocumentWritten(
  { document: 'driver_reviews/{reviewId}', region: 'southamerica-east1' },
  async (event) => {
    const after = event.data?.after.data()
    const before = event.data?.before.data()
    const driverUid = (after?.['driverUid'] ?? before?.['driverUid']) as string | undefined
    if (!driverUid) return

    const db = admin.firestore()
    const snap = await db
      .collection('driver_reviews')
      .where('driverUid', '==', driverUid)
      .where('deleted', '==', false)
      .get()

    let sum = 0
    let count = 0
    snap.forEach((d) => {
      const r = d.data()['rating']
      if (typeof r === 'number') {
        sum += r
        count++
      }
    })

    const update: Record<string, unknown> = {
      ratingCount: count,
      ratingAvg: count > 0 ? Math.round((sum / count) * 10) / 10 : admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    await db
      .collection('deliveryDrivers')
      .doc(driverUid)
      .set(update, { merge: true })
      .catch((e) => console.error('onDriverReviewWritten: falha ao atualizar entregador', driverUid, e))
  },
)
