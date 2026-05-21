import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

/**
 * Armazena o access_token Mercado Pago de um produtor na collection mp_tokens
 * (inacessível pelo client SDK). Somente admins podem chamar esta função.
 *
 * Quando o projeto adquirir um app MP Marketplace, o createOrder usará esse
 * token automaticamente para split de pagamento single-produtor.
 */
export const setProducerMpToken = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Não autenticado')
    }
    if (request.auth.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Somente administradores')
    }

    const { produtorId, accessToken } = request.data as {
      produtorId: string
      accessToken: string
    }

    if (!produtorId || typeof produtorId !== 'string') {
      throw new HttpsError('invalid-argument', 'produtorId inválido')
    }
    if (!accessToken || typeof accessToken !== 'string') {
      throw new HttpsError('invalid-argument', 'accessToken inválido')
    }

    const db = admin.firestore()

    const prodSnap = await db.collection('produtores').doc(produtorId).get()
    if (!prodSnap.exists) {
      throw new HttpsError('not-found', 'Produtor não encontrado')
    }

    await db.collection('mp_tokens').doc(produtorId).set({
      accessToken,
      updatedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('produtores').doc(produtorId).update({
      mpConnected: true,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

/**
 * Remove o token MP de um produtor e marca mpConnected = false.
 */
export const removeProducerMpToken = onCall(
  { region: 'southamerica-east1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Não autenticado')
    }
    if (request.auth.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Somente administradores')
    }

    const { produtorId } = request.data as { produtorId: string }
    if (!produtorId) throw new HttpsError('invalid-argument', 'produtorId inválido')

    const db = admin.firestore()

    await db.collection('mp_tokens').doc(produtorId).delete()
    await db.collection('produtores').doc(produtorId).update({
      mpConnected: false,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)
