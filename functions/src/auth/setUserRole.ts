import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface SetRoleData {
  uid: string
  role: 'cliente' | 'produtor' | 'admin' | 'entregador'
  restaurantIds?: string[]
  approved?: boolean
}

export const setUserRole = onCall<SetRoleData>(
  { region: 'southamerica-east1' },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem alterar roles.')
    }

    const { uid, role, restaurantIds, approved } = request.data

    if (!uid || !role) {
      throw new HttpsError('invalid-argument', 'uid e role são obrigatórios.')
    }

    const claims: Record<string, unknown> = { role }
    if (restaurantIds !== undefined) claims['restaurantIds'] = restaurantIds
    if (approved !== undefined) claims['approved'] = approved

    await admin.auth().setCustomUserClaims(uid, claims)

    await admin.firestore().collection('users').doc(uid).update({
      role,
      ...(approved !== undefined && { approved }),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await admin.firestore().collection('auditLogs').add({
      adminUid: request.auth.uid,
      adminEmail: request.auth.token['email'] ?? '',
      action: 'user.setRole',
      targetType: 'user',
      targetId: uid,
      after: claims,
      timestamp: FieldValue.serverTimestamp(),
    })

    return { success: true }
  },
)
