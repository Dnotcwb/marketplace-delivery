import type { Timestamp } from 'firebase/firestore'

export type UserRole = 'cliente' | 'produtor' | 'admin' | 'entregador' | 'horta'

export interface User {
  uid: string
  email: string
  emailVerified: boolean
  phone?: string
  phoneVerified: boolean
  name: string
  cpf?: string
  birthDate?: Timestamp
  photoUrl?: string

  role: UserRole
  produtorIds?: string[]
  /** ID da horta que este usuário gerencia (quando role='horta') */
  hortaId?: string
  approved?: boolean
  approvedAt?: Timestamp
  approvedBy?: string

  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt?: Timestamp
  deletedAt?: Timestamp

  preferences?: {
    notifications: {
      push: boolean
      email: boolean
      sms: boolean
      promotional: boolean
    }
  }
}


export interface FcmToken {
  token: string
  platform: 'web' | 'android' | 'ios'
  app: 'consumidor' | 'produtor' | 'backoffice' | 'entregador'
  deviceInfo?: string
  createdAt: Timestamp
  lastUsedAt: Timestamp
}

export interface UserNotification {
  id: string
  type: 'order_status' | 'promotion' | 'system' | 'approval'
  title: string
  body: string
  data?: Record<string, unknown>
  read: boolean
  createdAt: Timestamp
  expiresAt?: Timestamp
}
