import * as admin from 'firebase-admin'

export async function sendPushToOnlineDrivers(
  db: admin.firestore.Firestore,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  const driversSnap = await db
    .collection('deliveryDrivers')
    .where('status', '==', 'approved')
    .where('isOnline', '==', true)
    .get()

  if (driversSnap.empty) return

  const tokenEntries: { uid: string; token: string }[] = []

  await Promise.all(
    driversSnap.docs.map(async (driverDoc) => {
      const uid = driverDoc.id
      const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get()
      for (const t of tokensSnap.docs) {
        const token = t.data()['token'] as string
        if (token) tokenEntries.push({ uid, token })
      }
    }),
  )

  if (tokenEntries.length === 0) return

  const tokens = tokenEntries.map((e) => e.token)
  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification,
    data,
    webpush: {
      notification: { icon: '/icon-192.png', badge: '/icon-192.png' },
      fcmOptions: { link: data?.['url'] },
    },
  })

  // Remove tokens expirados
  const stale: string[] = []
  response.responses.forEach((r, i) => {
    if (!r.success && r.error?.code === 'messaging/registration-token-not-registered') {
      stale.push(tokens[i]!)
    }
  })

  if (stale.length > 0) {
    const batch = db.batch()
    for (const entry of tokenEntries.filter((e) => stale.includes(e.token))) {
      batch.delete(
        db.collection('users').doc(entry.uid).collection('fcmTokens').doc(entry.token),
      )
    }
    await batch.commit()
    console.log(`sendPushToOnlineDrivers: removeu ${stale.length} token(s) expirado(s)`)
  }

  console.log(
    `sendPushToOnlineDrivers: enviou para ${tokens.length} token(s) de ${driversSnap.size} entregador(es)`,
  )
}

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
