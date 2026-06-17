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
  userCreated: boolean
  passwordSetupLink?: string
  linkError?: string
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
  const result = await assignHortaManagerFn({
    email,
    hortaId,
    ...(name !== undefined && { name }),
  })
  return result.data
}

// ── refundOrder ─────────────────────────────────────────

const refundOrderFn = httpsCallable<{ orderId: string }, { ok: boolean; reason?: string }>(
  functions,
  'refundOrder',
)

/** Estorna o pagamento de um pedido no Stripe (somente admins). */
export async function callRefundOrder(orderId: string): Promise<{ ok: boolean; reason?: string }> {
  const result = await refundOrderFn({ orderId })
  return result.data
}

// ── auditGhostUsers ─────────────────────────────────────

export interface AuditedUser {
  uid: string
  email: string
  name: string
  role: string
  createdAt: string
  issue: 'orphaned_claim' | 'ghost'
  detail: string
}

export interface AuditUsersResult {
  found: AuditedUser[]
  revoked: string[]
  deleted: string[]
  dryRun: boolean
  totalFound: number
}

interface AuditUsersData {
  dryRun?: boolean
  revokeOrphans?: boolean
  deleteUids?: string[]
}

const auditGhostUsersFn = httpsCallable<AuditUsersData, AuditUsersResult>(
  functions,
  'auditGhostUsers',
)

/**
 * Auditoria geral de usuários (somente admins): detecta claims órfãos
 * (role sem cadastro correspondente) e contas fantasmas (sem atividade).
 */
export async function callAuditGhostUsers(data: AuditUsersData): Promise<AuditUsersResult> {
  const result = await auditGhostUsersFn(data)
  return result.data
}

// ── generateAccessLink ──────────────────────────────────

export interface AccessLinkResult {
  email: string
  link: string
}

const generateAccessLinkFn = httpsCallable<{ uid: string }, AccessLinkResult>(
  functions,
  'generateAccessLink',
)

/**
 * Gera um link de redefinição de senha para o usuário (somente admins).
 * Útil para contas com e-mail fictício: o link é exibido no backoffice
 * para ser copiado e enviado por outro canal.
 */
export async function callGenerateAccessLink(uid: string): Promise<AccessLinkResult> {
  const result = await generateAccessLinkFn({ uid })
  return result.data
}

// ── Stripe Connect (onboarding do produtor) ─────────────

const getStripeOnboardingLinkFn = httpsCallable<{ produtorId: string }, { url: string }>(
  functions,
  'getStripeOnboardingLink',
)

const refreshStripeAccountStatusFn = httpsCallable<
  { produtorId: string },
  { hasAccount: boolean; stripeOnboarded: boolean }
>(functions, 'refreshStripeAccountStatus')

/**
 * Cria (se necessário) a conta Stripe Connect do produtor e devolve um link
 * de onboarding hospedado. Chamável pelo dono do produtor ou por admin.
 */
export async function callGetStripeOnboardingLink(produtorId: string): Promise<string> {
  const result = await getStripeOnboardingLinkFn({ produtorId })
  return result.data.url
}

/** Reconsulta o status da conta Stripe e sincroniza o flag stripeOnboarded. */
export async function callRefreshStripeAccountStatus(
  produtorId: string,
): Promise<{ hasAccount: boolean; stripeOnboarded: boolean }> {
  const result = await refreshStripeAccountStatusFn({ produtorId })
  return result.data
}
