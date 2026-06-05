import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface SetRoleData {
  uid: string
  role: 'cliente' | 'produtor' | 'admin' | 'entregador' | 'horta'
  produtorIds?: string[]
  hortaId?: string
  approved?: boolean
}

export const setUserRole = onCall<SetRoleData>(
  { region: 'southamerica-east1' },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem alterar roles.')
    }

    const { uid, role, produtorIds, hortaId, approved } = request.data

    if (!uid || !role) {
      throw new HttpsError('invalid-argument', 'uid e role são obrigatórios.')
    }

    const claims: Record<string, unknown> = { role }
    if (produtorIds !== undefined) claims['produtorIds'] = produtorIds
    if (hortaId !== undefined) claims['hortaId'] = hortaId
    if (approved !== undefined) claims['approved'] = approved

    await admin.auth().setCustomUserClaims(uid, claims)

    const userUpdate: Record<string, unknown> = {
      role,
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (approved !== undefined) userUpdate['approved'] = approved
    if (hortaId !== undefined) {
      userUpdate['hortaId'] = hortaId
    } else if (role !== 'horta') {
      // Limpa hortaId ao mudar para outro role
      userUpdate['hortaId'] = FieldValue.delete()
    }

    await admin.firestore().collection('users').doc(uid).update(userUpdate)

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
