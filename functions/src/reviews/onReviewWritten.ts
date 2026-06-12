import * as admin from 'firebase-admin'
import { onDocumentWritten } from 'firebase-functions/v2/firestore'

/**
 * Mantém produtores/{id}.ratingAvg e ratingCount sempre que uma review é
 * criada, removida (soft delete) ou alterada. Recalcula a partir das reviews
 * não removidas do produtor — barato no volume esperado e sempre consistente.
 */
export const onReviewWritten = onDocumentWritten(
  { document: 'reviews/{reviewId}', region: 'southamerica-east1' },
  async (event) => {
    const after = event.data?.after.data()
    const before = event.data?.before.data()
    const produtorId = (after?.['produtorId'] ?? before?.['produtorId']) as string | undefined
    if (!produtorId) return

    const db = admin.firestore()
    const snap = await db
      .collection('reviews')
      .where('produtorId', '==', produtorId)
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
      .collection('produtores')
      .doc(produtorId)
      .set(update, { merge: true })
      .catch((e) => console.error('onReviewWritten: falha ao atualizar produtor', produtorId, e))
  },
)
