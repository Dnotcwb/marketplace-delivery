import { functions } from '@marketplace/shared-firebase'
import { httpsCallable } from 'firebase/functions'

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
