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
  role: 'cliente' | 'produtor' | 'admin' | 'entregador'
  produtorIds?: string[]
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
