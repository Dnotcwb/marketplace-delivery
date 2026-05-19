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
