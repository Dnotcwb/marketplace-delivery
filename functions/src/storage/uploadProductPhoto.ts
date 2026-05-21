import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { randomUUID } from 'crypto'

// Lê o bucket do FIREBASE_CONFIG (injetado pelo Firebase CLI); fallback explícito.
function getStorageBucket(): string {
  try {
    const cfg = JSON.parse(process.env['FIREBASE_CONFIG'] ?? '{}') as { storageBucket?: string }
    if (cfg.storageBucket) return cfg.storageBucket
  } catch { /* ignora */ }
  return 'marketplace-delivery-dev.firebasestorage.app'
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
    const bucketName = getStorageBucket()

    console.log(`uploadProductPhoto: bucket=${bucketName} path=${storagePath} size=${buffer.length}`)

    try {
      const bucket = admin.storage().bucket(bucketName)
      const file = bucket.file(storagePath)

      await file.save(buffer, {
        contentType,
        metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } },
      })

      const encodedPath = encodeURIComponent(storagePath)
      const photoUrl =
        `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o` +
        `/${encodedPath}?alt=media&token=${downloadToken}`

      console.log(`uploadProductPhoto: OK → ${photoUrl}`)
      return { photoUrl }
    } catch (err) {
      console.error('uploadProductPhoto erro (bucket=%s):', bucketName, err)
      throw new HttpsError(
        'internal',
        `Falha ao salvar foto [bucket=${bucketName}]: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },
)

void admin.app()
