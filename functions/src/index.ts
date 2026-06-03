import * as admin from 'firebase-admin'

admin.initializeApp()

export { onUserCreated } from './auth/onUserCreated'
export { setUserRole } from './auth/setUserRole'
export { cleanupGhostProdutores } from './auth/cleanupGhostProdutores'
export { createOrder } from './orders/createOrder'
export { mercadoPagoWebhook } from './webhooks/mercadoPagoWebhook'
export { onOrderStatusChanged } from './orders/onOrderStatusChanged'
export { onOrderCreated } from './orders/onOrderCreated'
export { acceptDelivery } from './orders/acceptDelivery'
export { uploadProductPhoto } from './storage/uploadProductPhoto'
export { onFilhoStatusChanged } from './orders/onFilhoStatusChanged'
export { onPedidoFilhoCriado } from './orders/onPedidoFilhoCriado'
export { setProducerMpToken, removeProducerMpToken } from './payments/setProducerMpToken'
