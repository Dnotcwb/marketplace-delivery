import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * Permite que um usuário com role='produtor' mas sem documento em `produtores`
 * revogue seu próprio claim quebrado, voltando para role='cliente'.
 *
 * Seguro: só executa se o estado for realmente inválido (claim='produtor' + sem doc).
 * Nunca eleva permissões — apenas reverte para o estado base.
 */
export const selfRevokeOrphanedClaim = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.')
    }

    const uid = request.auth.uid
    const role = request.auth.token['role'] as string | undefined

    if (role !== 'produtor') {
      // Não tem claim de produtor — nada a fazer
      return { revoked: false, reason: 'no_producer_claim' }
    }

    // Verifica se existe algum documento de produtor para este usuário
    const produtorSnap = await admin.firestore()
      .collection('produtores')
      .where('ownerUid', '==', uid)
      .limit(1)
      .get()

    if (!produtorSnap.empty) {
      // Tem documento ativo — não revoga (estado válido)
      return { revoked: false, reason: 'has_active_produtor' }
    }

    // Estado inválido: claim='produtor' sem documento → revoga
    await admin.auth().setCustomUserClaims(uid, { role: 'cliente' })
    await admin.firestore().collection('users').doc(uid).update({
      role: 'cliente',
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => { /* doc pode não existir */ })

    return { revoked: true }
  },
)
