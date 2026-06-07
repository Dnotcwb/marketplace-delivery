import { functions } from '@marketplace/shared-firebase'
import { httpsCallable } from 'firebase/functions'

// ── cleanupGhostProdutores ──────────────────────────────

export interface GhostAccount {
  uid: string
  email: string
  name: string
  createdAt: string
  registrationStatus?: string
}

interface CleanupData {
  emails?: string[]
  autoClean?: boolean
  dryRun?: boolean
}

interface CleanupResult {
  found: GhostAccount[]
  deleted: string[]
  dryRun: boolean
  totalFound: number
  totalDeleted: number
}

// ── selfRevokeOrphanedClaim ────────────────────────────

const selfRevokeOrphanedClaimFn = httpsCallable<void, { revoked: boolean; reason?: string }>(
  functions,
  'selfRevokeOrphanedClaim',
)

/** Revoga o claim role='produtor' quando não existe documento em `produtores`.
 *  Seguro: só executa se o estado for realmente inválido. */
export async function callSelfRevokeOrphanedClaim(): Promise<{ revoked: boolean }> {
  const result = await selfRevokeOrphanedClaimFn()
  return result.data
}

// ── cleanupGhostProdutores ──────────────────────────────

const cleanupGhostProdutoresFn = httpsCallable<CleanupData, CleanupResult>(
  functions,
  'cleanupGhostProdutores',
)

export async function callCleanupGhostProdutores(data: CleanupData): Promise<CleanupResult> {
  const result = await cleanupGhostProdutoresFn(data)
  return result.data
}

// ── setUserRole ─────────────────────────────────────────

interface SetRoleData {
  uid: string
  role: 'cliente' | 'produtor' | 'admin' | 'entregador' | 'horta'
  produtorIds?: string[]
  hortaId?: string
  approved?: boolean
}

const setUserRoleFn = httpsCallable<SetRoleData, { success: boolean }>(
  functions,
  'setUserRole',
)

/** Chama a Cloud Function setUserRole para atualizar custom claims. */
export async function callSetUserRole(data: SetRoleData): Promise<void> {
  await setUserRoleFn(data)
}

// ── assignHortaManager ──────────────────────────────────

interface AssignHortaManagerResult {
  uid: string
  email: string
  name: string
  /** true = conta criada pelo sistema agora */
  userCreated: boolean
}

const assignHortaManagerFn = httpsCallable<
  { email: string; hortaId: string; name?: string },
  AssignHortaManagerResult
>(functions, 'assignHortaManager')

/**
 * Atribui (ou cria) um responsável de horta.
 * Se o email não existir no sistema, a conta é criada automaticamente.
 * Quando userCreated=true, o chamador deve enviar o email de redefinição de senha.
 */
export async function callAssignHortaManager(
  email: string,
  hortaId: string,
  name?: string,
): Promise<AssignHortaManagerResult> {
  const result = await assignHortaManagerFn({ email, hortaId, name })
  return result.data
}

const setProducerMpTokenFn = httpsCallable<
  { produtorId: string; accessToken: string },
  { ok: boolean }
>(functions, 'setProducerMpToken')

const removeProducerMpTokenFn = httpsCallable<
  { produtorId: string },
  { ok: boolean }
>(functions, 'removeProducerMpToken')

/** Armazena o access_token MP de um produtor (somente admins). */
export async function callSetProducerMpToken(
  produtorId: string,
  accessToken: string,
): Promise<void> {
  await setProducerMpTokenFn({ produtorId, accessToken })
}

/** Remove o token MP de um produtor (somente admins). */
export async function callRemoveProducerMpToken(produtorId: string): Promise<void> {
  await removeProducerMpTokenFn({ produtorId })
}
