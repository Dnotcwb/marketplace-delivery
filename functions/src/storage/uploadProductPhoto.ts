import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { randomUUID } from 'crypto'
import { GoogleAuth } from 'google-auth-library'

// Buckets .firebasestorage.app NÃO estão acessíveis via GCS API (storage.googleapis.com).
// Usamos a Firebase Storage REST API (firebasestorage.googleapis.com) diretamente.

function getStorageBucket(): string {
  try {
    const config = JSON.parse(process.env['FIREBASE_CONFIG'] ?? '{}') as { storageBucket?: string }
    if (config.storageBucket) return config.storageBucket
  } catch { /* ignora */ }
  return `${process.env['GCLOUD_PROJECT'] ?? ''}.firebasestorage.app`
}

const gAuth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/devstorage.full_control'],
})

async function getAccessToken(): Promise<string> {
  const client = await gAuth.getClient()
  const res = await client.getAccessToken()
  if (!res.token) throw new Error('Não foi possível obter access token')
  return res.token
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
      throw new HttpsError('invalid-argument', 'Imagem muito grande (máx 6 MB após compressão)')
    }

    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    const storagePath = `produtores/${produtorId}/products/${productId}/photo.${ext}`

    try {
      const bucketName = getStorageBucket()
      const downloadToken = randomUUID()
      const accessToken = await getAccessToken()

      console.log(`uploadProductPhoto: bucket=${bucketName} path=${storagePath}`)

      // 1. Upload via Firebase Storage REST API
      const uploadUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o` +
        `?name=${encodeURIComponent(storagePath)}&uploadType=media`

      const uploadRes = await fetch(uploadUrl, {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': contentType,
        },
        body: buffer,
      })

      if (!uploadRes.ok) {
        const body = await uploadRes.text()
        throw new Error(`Upload falhou (${uploadRes.status}): ${body}`)
      }

      // 2. Define download token para gerar URL pública permanente
      const metaUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}`

      await fetch(metaUrl, {
        method:  'PATCH',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata: { firebaseStorageDownloadTokens: downloadToken } }),
      })

      const photoUrl = `${metaUrl}?alt=media&token=${downloadToken}`
      console.log(`uploadProductPhoto: OK → ${photoUrl}`)
      return { photoUrl }

    } catch (err) {
      console.error('uploadProductPhoto erro:', err)
      throw new HttpsError('internal', `Falha ao salvar foto: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
)

// Mantém o admin inicializado para o token de autenticação
void admin.app()
