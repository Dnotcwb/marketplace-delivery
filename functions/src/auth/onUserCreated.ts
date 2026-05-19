import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import * as functionsV1 from 'firebase-functions/v1'

export const onUserCreated = functionsV1
  .region('southamerica-east1')
  .auth.user()
  .onCreate(async (user) => {
  const { uid, email, displayName, photoURL } = user

  await admin.firestore().collection('users').doc(uid).set({
    uid,
    email: email ?? '',
    emailVerified: user.emailVerified,
    name: displayName ?? email?.split('@')[0] ?? 'Usuário',
    photoUrl: photoURL ?? null,
    phoneVerified: false,
    role: 'cliente',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
})
