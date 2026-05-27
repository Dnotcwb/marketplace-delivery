import * as admin from 'firebase-admin'

export async function sendPushToUser(
  db: admin.firestore.Firestore,
  uid: string,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  const snap = await db.collection('users').doc(uid).collection('fcmTokens').get()
  if (snap.empty) return

  const tokens = snap.docs.map((d) => d.data()['token'] as string).filter(Boolean)
  if (tokens.length === 0) return

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification,
    data,
    webpush: {
      notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
      fcmOptions: { link: data?.['url'] },
    },
  })

  // Remove tokens expirados ou inválidos
  const stale: string[] = []
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      stale.push(tokens[i]!)
    }
  })

  if (stale.length > 0) {
    const batch = db.batch()
    for (const token of stale) {
      batch.delete(db.collection('users').doc(uid).collection('fcmTokens').doc(token))
    }
    await batch.commit()
    console.log(`sendPushToUser: removeu ${stale.length} token(s) expirado(s) de ${uid}`)
  }
}
