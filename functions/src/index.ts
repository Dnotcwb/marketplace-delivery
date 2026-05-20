import * as admin from 'firebase-admin'

admin.initializeApp()

export { onUserCreated } from './auth/onUserCreated'
export { setUserRole } from './auth/setUserRole'
export { createOrder } from './orders/createOrder'
export { mercadoPagoWebhook } from './webhooks/mercadoPagoWebhook'
export { onOrderStatusChanged } from './orders/onOrderStatusChanged'
export { acceptDelivery } from './orders/acceptDelivery'
