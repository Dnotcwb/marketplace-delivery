import type { Timestamp } from 'firebase/firestore'

export type VehicleType = 'moto' | 'bicicleta' | 'carro' | 'van'
export type DriverStatus = 'pending_approval' | 'approved' | 'suspended' | 'rejected'

export interface DeliveryDriver {
  uid: string
  displayName: string
  email: string
  phone: string
  cpf?: string
  vehicleType: VehicleType
  vehiclePlate?: string
  photoUrl?: string
  status: DriverStatus
  isOnline?: boolean
  /** Média das avaliações (1–5), mantida por Cloud Function. Ausente = sem avaliações ainda. */
  ratingAvg?: number
  /** Quantidade de avaliações não removidas. */
  ratingCount?: number
  approvedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
