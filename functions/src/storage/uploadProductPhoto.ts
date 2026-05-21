import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { randomUUID } from 'crypto'

// Buckets .firebasestorage.app só aceitam Firebase Auth ID tokens — não aceitam
// tokens OAuth2 de service accounts nem a GCS API. Criamos um custom token com
// role=admin e o trocamos por um ID token via Firebase Auth REST API.
const BUCKET = 'marketplace-delivery-dev.firebasestorage.app'

async function getFirebaseIdToken(): Promise<string> {
  const customToken = await admin.auth().createCustomToken('cloud-function-uploader', {
    role: 'admin',
  })

  const apiKey = process.env['FIREBASE_API_KEY']
  if (!apiKey) throw new Error('Variável FIREBASE_API_KEY não configurada nas Functions')

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Falha ao obter ID token (${res.status}): ${body}`)
  }

  const data = await res.json() as { idToken?: string }
  if (!data.idToken) throw new Error('Firebase Auth não retornou idToken')
  return data.idToken
}

export const uploadProductPhoto = onCall(
  { region: 'southamerica-east1', maxInstances: 10 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Login necessário')
    }

    const data = request.data as {
      produtorId?: string
      productId?: string
      imageBase64?: string
      contentType?: string
    }

    const { produtorId, productId, imageBase64, contentType } = data

    if (!produtorId || !productId || !imageBase64 || !contentType) {
      throw new HttpsError('invalid-argument', 'Dados incompletos')
    }

    if (!contentType.startsWith('image/')) {
      throw new HttpsError('invalid-argument', 'Tipo de arquivo inválido')
    }

    const role = request.auth.token['role'] as string | undefined
    const produtorIds = request.auth.token['produtorIds'] as unknown

    const isAdminUser = role === 'admin'
    const isOwner = Array.isArray(produtorIds)
      ? (produtorIds as string[]).includes(produtorId)
      : typeof produtorIds === 'object' && produtorIds !== null && produtorId in (produtorIds as object)

    if (!isAdminUser && !isOwner) {
      throw new HttpsError('permission-denied', 'Sem permissão para este produtor')
    }

    const buffer = Buffer.from(imageBase64, 'base64')

    if (buffer.length > 8 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'Imagem muito grande (máx 8 MB)')
    }

    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    const storagePath = `produtores/${produtorId}/products/${productId}/photo.${ext}`
    const downloadToken = randomUUID()

    console.log(`uploadProductPhoto: bucket=${BUCKET} path=${storagePath} size=${buffer.length}`)

    try {
      const idToken = await getFirebaseIdToken()

      const uploadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(BUCKET)}/o` +
        `?name=${encodeURIComponent(storagePath)}&uploadType=media`

      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Firebase ${idToken}`,
          'Content-Type': contentType,
        },
        body: buffer,
      })

      if (!uploadRes.ok) {
        const body = await uploadRes.text()
        console.error(`upload falhou status=${uploadRes.status} body=${body}`)
        throw new Error(`Upload falhou (${uploadRes.status}): ${body}`)
      }

      // Injeta download token para URL pública permanente
      const metaUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(BUCKET)}/o` +
        `/${encodeURIComponent(storagePath)}`

      await fetch(metaUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Firebase ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
      })

      const photoUrl = `${metaUrl}?alt=media&token=${downloadToken}`
      console.log(`uploadProductPhoto: OK → ${photoUrl}`)
      return { photoUrl }
    } catch (err) {
      console.error('uploadProductPhoto erro:', err)
      throw new HttpsError(
        'internal',
        `Falha ao salvar foto: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },
)

void admin.app()
