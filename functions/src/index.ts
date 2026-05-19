import * as admin from 'firebase-admin'

admin.initializeApp()

export { onUserCreated } from './auth/onUserCreated'
export { setUserRole } from './auth/setUserRole'
