import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface AssignData {
  email: string
  hortaId: string
  /** Nome do responsável — obrigatório apenas ao criar conta nova */
  name?: string
}

interface AssignResult {
  uid: string
  email: string
  name: string
  /** true = conta criada agora, false = conta já existia */
  userCreated: boolean
}

export const assignHortaManager = onCall<AssignData>(
  { region: 'southamerica-east1' },
  async (request): Promise<AssignResult> => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem atribuir responsáveis.')
    }

    const { email, hortaId, name } = request.data
    if (!email || !hortaId) {
      throw new HttpsError('invalid-argument', 'email e hortaId são obrigatórios.')
    }

    // Verifica se a horta existe antes de fazer qualquer coisa
    const hortaDoc = await admin.firestore().collection('hortas').doc(hortaId).get()
    if (!hortaDoc.exists) {
      throw new HttpsError('not-found', 'Horta não encontrada.')
    }

    // Busca ou cria o usuário pelo email
    let userRecord: admin.auth.UserRecord
    let userCreated = false

    try {
      userRecord = await admin.auth().getUserByEmail(email)
    } catch {
      // Usuário não existe — cria a conta
      const displayName = (name?.trim()) || email.split('@')[0]!
      userRecord = await admin.auth().createUser({
        email,
        displayName,
        emailVerified: false,
      })
      // Cria o documento do usuário no Firestore
      await admin.firestore().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        emailVerified: false,
        name: displayName,
        phoneVerified: false,
        role: 'cliente',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      userCreated = true
    }

    const uid = userRecord.uid
    const currentClaims = userRecord.customClaims as Record<string, unknown> | null
    const currentRole = currentClaims?.['role'] as string | undefined

    // Bloqueia roles que não podem ser alteradas por este fluxo
    if (currentRole === 'admin' || currentRole === 'entregador') {
      // Se acabou de criar o usuário, desfaz
      if (userCreated) {
        await admin.auth().deleteUser(uid).catch(() => {})
      }
      throw new HttpsError(
        'failed-precondition',
        `Este usuário já possui o perfil "${currentRole}" e não pode ser atribuído como responsável de horta.`,
      )
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

    // Atribui as claims
    await admin.auth().setCustomUserClaims(uid, { role: 'horta', hortaId })

    // Atualiza o documento do usuário
    const userName = userRecord.displayName || name?.trim() || email.split('@')[0]!
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
      action: userCreated ? 'horta.createAndAssignManager' : 'horta.assignManager',
      targetType: 'horta',
      targetId: hortaId,
      after: { ownerUid: uid, ownerEmail: email, ownerName: userName, userCreated },
      timestamp: FieldValue.serverTimestamp(),
    })

    return { uid, email, name: userName, userCreated }
  },
)
