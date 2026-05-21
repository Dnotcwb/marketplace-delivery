import type { Timestamp } from 'firebase/firestore'
import type { ProdutorAddress } from './produtor'

export interface Horta {
  id: string
  name: string
  slug: string
  description?: string
  address: ProdutorAddress
  logoUrl?: string
  bannerUrl?: string
  status: 'active' | 'inactive'
  /** IDs dos produtores que operam nesta horta */
  produtorIds: string[]
  deliveryFeeInCents: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
