import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface CleanupData {
  /** Lista de e-mails específicos para deletar (ex: casos manuais conhecidos) */
  emails?: string[]
  /** Se true, deleta automaticamente todos os registros incompletos com >1h */
  autoClean?: boolean
  /** Se true, apenas lista os fantasmas sem deletar nada */
  dryRun?: boolean
}

interface GhostAccount {
  uid: string
  email: string
  name: string
  createdAt: string
  registrationStatus?: string
}

export const cleanupGhostProdutores = onCall<CleanupData>(
  { region: 'southamerica-east1' },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores.')
    }

    const { emails = [], autoClean = false, dryRun = false } = request.data
    const found: GhostAccount[] = []
    const deleted: string[] = []
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const db = admin.firestore()

    // ──────────────────────────────────────────────────────
    // Caso 1: deletar por lista de e-mails específicos
    // ──────────────────────────────────────────────────────
    for (const email of emails) {
      let authUser: admin.auth.UserRecord
      try {
        authUser = await admin.auth().getUserByEmail(email.trim().toLowerCase())
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') continue
        throw err
      }

      // Só deleta se não tiver documento em `produtores`
      const produtorSnap = await db
        .collection('produtores')
        .where('ownerUid', '==', authUser.uid)
        .limit(1)
        .get()

      if (!produtorSnap.empty) continue // Tem cadastro completo — não mexe

      found.push({
        uid: authUser.uid,
        email: authUser.email ?? '',
        name: authUser.displayName ?? '',
        createdAt: authUser.metadata.creationTime ?? '',
      })

      if (!dryRun) {
        await admin.auth().deleteUser(authUser.uid)
        try { await db.collection('users').doc(authUser.uid).delete() } catch { /* já removido */ }
        deleted.push(authUser.email ?? email)
      }
    }

    // ──────────────────────────────────────────────────────
    // Caso 2: limpar automaticamente todos marcados como incompletos
    // ──────────────────────────────────────────────────────
    if (autoClean) {
      const uidsDeletados = new Set(found.map((g) => g.uid))

      const ghostsSnap = await db
        .collection('users')
        .where('registrationSource', '==', 'produtor')
        .get()

      for (const userDoc of ghostsSnap.docs) {
        if (uidsDeletados.has(userDoc.id)) continue // já processado acima

        const data = userDoc.data()
        if (data.registrationStatus !== 'wizard_pending') continue

        const createdAt = data.createdAt?.toDate?.() as Date | undefined
        if (!createdAt || createdAt > oneHourAgo) continue // Menos de 1h — ainda pode estar no wizard

        // Dupla verificação: sem documento em `produtores`
        const produtorSnap = await db
          .collection('produtores')
          .where('ownerUid', '==', userDoc.id)
          .limit(1)
          .get()

        if (!produtorSnap.empty) {
          // Tem produtor mas marcou mal — corrige o status
          if (!dryRun) {
            await db.collection('users').doc(userDoc.id).update({ registrationStatus: 'completed' })
          }
          continue
        }

        found.push({
          uid: userDoc.id,
          email: data.email ?? '',
          name: data.name ?? '',
          createdAt: createdAt.toISOString(),
          registrationStatus: data.registrationStatus,
        })

        if (!dryRun) {
          try { await admin.auth().deleteUser(userDoc.id) } catch { /* já deletado no Auth */ }
          await db.collection('users').doc(userDoc.id).delete()
          deleted.push(data.email)
        }
      }
    }

    return {
      found,
      deleted,
      dryRun,
      totalFound: found.length,
      totalDeleted: deleted.length,
    }
  },
)
