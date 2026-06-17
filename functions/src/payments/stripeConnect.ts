import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { getStripe, PRODUTOR_URL } from './stripeClient'

const REGION = 'southamerica-east1'

/**
 * Confere se o chamador é dono do produtor (ownerUid) ou admin.
 * Retorna os dados do produtor já carregados.
 */
async function loadOwnedProdutor(
  db: FirebaseFirestore.Firestore,
  produtorId: string,
  uid: string,
  isAdmin: boolean,
): Promise<FirebaseFirestore.DocumentData> {
  const snap = await db.collection('produtores').doc(produtorId).get()
  if (!snap.exists) throw new HttpsError('not-found', 'Produtor não encontrado')
  const data = snap.data()!
  if (!isAdmin && data['ownerUid'] !== uid) {
    throw new HttpsError('permission-denied', 'Você não é o dono deste produtor')
  }
  return data
}

/**
 * Cria (se necessário) a conta conectada Stripe do produtor e devolve um link
 * de onboarding hospedado. Modelo "separate charges and transfers": a conta
 * precisa apenas da capability `transfers` (e `card_payments`, exigida no BR).
 */
export const getStripeOnboardingLink = onCall(
  { region: REGION, secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado')
    const uid = request.auth.uid
    const isAdmin = request.auth.token['role'] === 'admin'

    const produtorId = (request.data as { produtorId?: string })?.produtorId
    if (!produtorId) throw new HttpsError('invalid-argument', 'produtorId é obrigatório')

    const db = admin.firestore()
    const produtor = await loadOwnedProdutor(db, produtorId, uid, isAdmin)
    const stripe = getStripe()

    let accountId = produtor['stripeAccountId'] as string | undefined

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: (produtor['email'] as string | undefined) ?? undefined,
        business_type: 'individual',
        capabilities: {
          // No Brasil, `transfers` exige também `card_payments`.
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { produtorId, produtorName: (produtor['name'] as string) ?? '' },
      })
      accountId = account.id
      await db.collection('produtores').doc(produtorId).update({
        stripeAccountId: accountId,
        stripeOnboarded: false,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${PRODUTOR_URL}/configuracoes?stripe=refresh`,
      return_url: `${PRODUTOR_URL}/configuracoes?stripe=return`,
      type: 'account_onboarding',
    })

    return { url: link.url }
  },
)

/**
 * Reconsulta o status da conta Stripe do produtor e sincroniza o flag
 * `stripeOnboarded`. Usado pelo app do produtor ao retornar do onboarding
 * (atualização imediata, sem depender do webhook account.updated).
 */
export const refreshStripeAccountStatus = onCall(
  { region: REGION, secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Não autenticado')
    const uid = request.auth.uid
    const isAdmin = request.auth.token['role'] === 'admin'

    const produtorId = (request.data as { produtorId?: string })?.produtorId
    if (!produtorId) throw new HttpsError('invalid-argument', 'produtorId é obrigatório')

    const db = admin.firestore()
    const produtor = await loadOwnedProdutor(db, produtorId, uid, isAdmin)
    const accountId = produtor['stripeAccountId'] as string | undefined

    if (!accountId) return { hasAccount: false, stripeOnboarded: false }

    const stripe = getStripe()
    const account = await stripe.accounts.retrieve(accountId)
    const onboarded = account.capabilities?.transfers === 'active'

    await db.collection('produtores').doc(produtorId).update({
      stripeOnboarded: onboarded,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { hasAccount: true, stripeOnboarded: onboarded }
  },
)
