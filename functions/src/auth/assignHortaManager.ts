import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface AssignData {
  email: string
  hortaId: string
}

export const assignHortaManager = onCall<AssignData>(
  { region: 'southamerica-east1' },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem atribuir responsáveis.')
    }

    const { email, hortaId } = request.data
    if (!email || !hortaId) {
      throw new HttpsError('invalid-argument', 'email e hortaId são obrigatórios.')
    }

    // Busca o usuário pelo email
    let userRecord: admin.auth.UserRecord
    try {
      userRecord = await admin.auth().getUserByEmail(email)
    } catch {
      throw new HttpsError('not-found', `Nenhum usuário encontrado com o email "${email}". O responsável deve criar uma conta no app primeiro.`)
    }

    const uid = userRecord.uid
    const currentClaims = userRecord.customClaims as Record<string, unknown> | null
    const currentRole = currentClaims?.['role'] as string | undefined

    // Bloqueia roles que não podem ser alteradas por este fluxo
    if (currentRole === 'admin' || currentRole === 'entregador') {
      throw new HttpsError(
        'failed-precondition',
        `Este usuário já possui o perfil "${currentRole}" e não pode ser atribuído como responsável de horta.`,
      )
    }

    // Verifica se a horta existe
    const hortaDoc = await admin.firestore().collection('hortas').doc(hortaId).get()
    if (!hortaDoc.exists) {
      throw new HttpsError('not-found', 'Horta não encontrada.')
    }

    const hortaData = hortaDoc.data() as Record<string, unknown>
    const oldOwnerUid = hortaData['ownerUid'] as string | undefined

    // Remove o responsável anterior se existir e for diferente do novo
    if (oldOwnerUid && oldOwnerUid !== uid) {
      await admin.auth().setCustomUserClaims(oldOwnerUid, { role: 'cliente' })
      await admin.firestore().collection('users').doc(oldOwnerUid).update({
        role: 'cliente',
        hortaId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {})
    }

    // Se o usuário já é gestor de outra horta, remove vínculo anterior
    const currentHortaId = currentClaims?.['hortaId'] as string | undefined
    if (currentHortaId && currentHortaId !== hortaId) {
      await admin.firestore().collection('hortas').doc(currentHortaId).update({
        ownerUid: FieldValue.delete(),
        ownerEmail: FieldValue.delete(),
        ownerName: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {})
    }

    // Atribui as claims ao novo responsável
    await admin.auth().setCustomUserClaims(uid, { role: 'horta', hortaId })

    // Atualiza o documento do usuário
    const userName = userRecord.displayName || email.split('@')[0]!
    await admin.firestore().collection('users').doc(uid).update({
      role: 'horta',
      hortaId,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {})

    // Atualiza a horta com os dados do responsável
    await admin.firestore().collection('hortas').doc(hortaId).update({
      ownerUid: uid,
      ownerEmail: email,
      ownerName: userName,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Registro de auditoria
    await admin.firestore().collection('auditLogs').add({
      adminUid: request.auth!.uid,
      action: 'horta.assignManager',
      targetType: 'horta',
      targetId: hortaId,
      after: { ownerUid: uid, ownerEmail: email, ownerName: userName },
      timestamp: FieldValue.serverTimestamp(),
    })

    return { uid, email, name: userName }
  },
)
