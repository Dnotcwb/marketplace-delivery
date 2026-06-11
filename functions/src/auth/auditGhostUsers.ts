import * as admin from 'firebase-admin'
import { FieldValue } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

interface AuditData {
  /** true = apenas lista, não altera nada */
  dryRun?: boolean
  /** true = revoga (→ cliente) todos os claims órfãos encontrados */
  revokeOrphans?: boolean
  /** UIDs específicos para excluir (conta Auth + doc users) */
  deleteUids?: string[]
}

export interface AuditedUser {
  uid: string
  email: string
  name: string
  role: string
  createdAt: string
  issue: 'orphaned_claim' | 'ghost'
  detail: string
}

/**
 * Auditoria geral de usuários (somente admin).
 *
 * Percorre TODAS as contas do Firebase Auth e cruza com o Firestore:
 * - `orphaned_claim`: claim de role (produtor/entregador/horta) sem o cadastro
 *   correspondente — ex: role='entregador' sem doc em deliveryDrivers. Essas
 *   contas acessariam apps sem aparecer no backoffice.
 * - `ghost`: conta sem claim de role e sem qualquer atividade (nenhum pedido,
 *   produtor ou perfil de entregador) com mais de 24h — candidata a exclusão.
 *   Fantasmas NUNCA são excluídos automaticamente: só via deleteUids explícito.
 *
 * Contas admin nunca são sinalizadas nem alteradas.
 */
export const auditGhostUsers = onCall<AuditData>(
  { region: 'southamerica-east1', timeoutSeconds: 300 },
  async (request) => {
    if (request.auth?.token['role'] !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas administradores.')
    }

    const { dryRun = true, revokeOrphans = false, deleteUids = [] } = request.data
    const db = admin.firestore()

    const found: AuditedUser[] = []
    const revoked: string[] = []
    const deleted: string[] = []
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    // ── Varre todas as contas do Auth (paginado) ──────────────
    let pageToken: string | undefined
    do {
      const page = await admin.auth().listUsers(1000, pageToken)
      pageToken = page.pageToken

      for (const user of page.users) {
        const claims = (user.customClaims ?? {}) as Record<string, unknown>
        const role = (claims['role'] as string | undefined) ?? 'cliente'
        const base = {
          uid: user.uid,
          email: user.email ?? '',
          name: user.displayName ?? '',
          role,
          createdAt: user.metadata.creationTime ?? '',
        }

        if (role === 'admin') continue

        if (role === 'produtor') {
          const snap = await db.collection('produtores')
            .where('ownerUid', '==', user.uid).limit(1).get()
          if (snap.empty) {
            found.push({ ...base, issue: 'orphaned_claim', detail: 'Claim de produtor sem cadastro em produtores' })
          }
          continue
        }

        if (role === 'entregador') {
          const snap = await db.collection('deliveryDrivers').doc(user.uid).get()
          if (!snap.exists) {
            found.push({ ...base, issue: 'orphaned_claim', detail: 'Claim de entregador sem cadastro em deliveryDrivers' })
          }
          continue
        }

        if (role === 'horta') {
          const hortaId = claims['hortaId'] as string | undefined
          const hortaSnap = hortaId ? await db.collection('hortas').doc(hortaId).get() : null
          const ownerUid = hortaSnap?.data()?.['ownerUid'] as string | undefined
          if (!hortaId || !hortaSnap?.exists || ownerUid !== user.uid) {
            found.push({ ...base, issue: 'orphaned_claim', detail: 'Claim de gestor sem horta correspondente (ou horta com outro responsável)' })
          }
          continue
        }

        // ── Sem role (cliente): candidato a fantasma se não tem atividade ──
        const createdMs = user.metadata.creationTime
          ? new Date(user.metadata.creationTime).getTime()
          : Date.now()
        if (createdMs > oneDayAgo) continue // conta recente — pode estar em uso

        const [orderSnap, produtorSnap, driverSnap] = await Promise.all([
          db.collection('orders').where('customerId', '==', user.uid).limit(1).get(),
          db.collection('produtores').where('ownerUid', '==', user.uid).limit(1).get(),
          db.collection('deliveryDrivers').doc(user.uid).get(),
        ])
        if (orderSnap.empty && produtorSnap.empty && !driverSnap.exists) {
          found.push({ ...base, issue: 'ghost', detail: 'Sem pedidos, sem cadastro de produtor ou entregador (+24h)' })
        }
      }
    } while (pageToken)

    // ── Ações ────────────────────────────────────────────────
    if (!dryRun && revokeOrphans) {
      for (const u of found.filter((f) => f.issue === 'orphaned_claim')) {
        await admin.auth().setCustomUserClaims(u.uid, { role: 'cliente' })
        await db.collection('users').doc(u.uid).update({
          role: 'cliente',
          hortaId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        }).catch(() => { /* doc pode não existir */ })
        revoked.push(u.email || u.uid)
      }
    }

    if (!dryRun && deleteUids.length > 0) {
      const flagged = new Map(found.map((f) => [f.uid, f]))
      for (const uid of deleteUids) {
        const f = flagged.get(uid)
        // Só exclui contas que ESTA análise sinalizou — nunca uids arbitrários
        if (!f) continue
        try { await admin.auth().deleteUser(uid) } catch { /* já removida no Auth */ }
        await db.recursiveDelete(db.collection('users').doc(uid)).catch(() => {})
        deleted.push(f.email || uid)
      }
    }

    if (!dryRun && (revoked.length > 0 || deleted.length > 0)) {
      await db.collection('auditLogs').add({
        adminUid: request.auth.uid,
        adminEmail: request.auth.token['email'] ?? '',
        action: 'user.auditGhostUsers',
        after: { revoked, deleted },
        timestamp: FieldValue.serverTimestamp(),
      })
    }

    return {
      found,
      revoked,
      deleted,
      dryRun,
      totalFound: found.length,
    }
  },
)
