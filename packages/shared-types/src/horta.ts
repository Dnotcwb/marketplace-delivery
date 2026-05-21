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
  /** Taxa adicional por km além da base (0 = taxa fixa) */
  deliveryFeePerKmInCents?: number
  /** Raio máximo de entrega em km (0 ou ausente = ilimitado) */
  deliveryRadiusKm?: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
  /** Coordenadas geográficas para cálculo de frete dinâmico */
  lat?: number
  lng?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
