import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

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

    // Verifica ownership do produtor
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
    const path = `produtores/${produtorId}/products/${productId}/photo.${ext}`

    const bucket = admin.storage().bucket()
    const file = bucket.file(path)

    // Gera download token para a URL do Firebase Storage
    const token = crypto.randomUUID()

    await file.save(buffer, {
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    })

    const encodedPath = encodeURIComponent(path)
    const photoUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`

    console.log(`uploadProductPhoto: ${path} salvo`)
    return { photoUrl }
  },
)
