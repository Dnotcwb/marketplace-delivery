import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * Permite que um usuário com claim de role órfão (sem o cadastro correspondente
 * no Firestore) revogue o próprio claim, voltando para role='cliente'.
 *
 * Cobre os três roles que dependem de documento:
 * - produtor   → precisa de doc em `produtores` com ownerUid = uid
 * - entregador → precisa de doc em `deliveryDrivers/{uid}`
 * - horta      → precisa de `hortas/{hortaId}` existente com ownerUid = uid
 *
 * Seguro: só executa se o estado for realmente inválido. Nunca eleva
 * permissões — apenas reverte para o estado base.
 */
export const selfRevokeOrphanedClaim = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Autenticação necessária.')
    }

    const uid = request.auth.uid
    const role = request.auth.token['role'] as string | undefined
    const db = admin.firestore()

    let orphaned = false

    if (role === 'produtor') {
      const snap = await db.collection('produtores')
        .where('ownerUid', '==', uid).limit(1).get()
      if (!snap.empty) return { revoked: false, reason: 'has_active_produtor' }
      orphaned = true
    } else if (role === 'entregador') {
      const snap = await db.collection('deliveryDrivers').doc(uid).get()
      if (snap.exists) return { revoked: false, reason: 'has_driver_profile' }
      orphaned = true
    } else if (role === 'horta') {
      const hortaId = request.auth.token['hortaId'] as string | undefined
      const hortaSnap = hortaId ? await db.collection('hortas').doc(hortaId).get() : null
      const ownerUid = hortaSnap?.data()?.['ownerUid'] as string | undefined
      if (hortaId && hortaSnap?.exists && ownerUid === uid) {
        return { revoked: false, reason: 'has_active_horta' }
      }
      orphaned = true
    } else {
      // cliente/admin/sem claim — nada a revogar
      return { revoked: false, reason: 'no_revocable_claim' }
    }

    if (!orphaned) return { revoked: false, reason: 'state_valid' }

    // Estado inválido: claim sem cadastro correspondente → revoga
    await admin.auth().setCustomUserClaims(uid, { role: 'cliente' })
    await db.collection('users').doc(uid).update({
      role: 'cliente',
      hortaId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => { /* doc pode não existir */ })

    return { revoked: true }
  },
)
