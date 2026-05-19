import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { auth } from 'firebase-functions/v2'

export const onUserCreated = auth.user().onCreate(async (user) => {
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
