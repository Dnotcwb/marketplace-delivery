import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface GenerateAccessLinkData {
  /** UID do usuário (Firebase Auth) que receberá o link de redefinição de senha */
  uid: string
}

interface GenerateAccessLinkResult {
  email: string
  link: string
}

/**
 * Gera um link de redefinição de senha para qualquer usuário (somente admin).
 *
 * Pensado para contas com e-mail fictício/inacessível: o link é devolvido ao
 * backoffice, que o exibe com botão de copiar — o admin envia por WhatsApp ou
 * abre direto, sem depender de entrega de e-mail. Mesmo padrão usado no
 * assignHortaManager.
 */
export const generateAccessLink = onCall<GenerateAccessLinkData>(
  { region: 'southamerica-east1' },
  async (request): Promise<GenerateAccessLinkResult> => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores podem gerar links de acesso.')
    }

    const { uid } = request.data
    if (!uid) {
      throw new HttpsError('invalid-argument', 'uid é obrigatório.')
    }

    let userRecord: admin.auth.UserRecord
    try {
      userRecord = await admin.auth().getUser(uid)
    } catch {
      throw new HttpsError('not-found', 'Usuário não encontrado no Firebase Auth.')
    }

    const email = userRecord.email
    if (!email) {
      throw new HttpsError('failed-precondition', 'Este usuário não possui e-mail cadastrado.')
    }

    let link: string
    try {
      link = await admin.auth().generatePasswordResetLink(email)
    } catch (err) {
      console.error('generateAccessLink: generatePasswordResetLink falhou:', err)
      throw new HttpsError('internal', 'Não foi possível gerar o link de redefinição.')
    }

    await admin.firestore().collection('auditLogs').add({
      adminUid: request.auth.uid,
      adminEmail: request.auth.token['email'] ?? '',
      action: 'user.generateAccessLink',
      targetType: 'user',
      targetId: uid,
      timestamp: FieldValue.serverTimestamp(),
    })

    return { email, link }
  },
)
