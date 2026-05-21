import type { Timestamp } from 'firebase/firestore'

// ──────────────────────────────────────────────────────
//  Status
// ──────────────────────────────────────────────────────

export type ProdutorStatus = 'pending' | 'approved' | 'suspended' | 'rejected'

export type ProdutorCertification =
  | 'organico'
  | 'agroecologico'
  | 'natural'
  | 'biodynamico'
  | 'sem_agrotoxicos'

// ──────────────────────────────────────────────────────
//  Endereço
// ──────────────────────────────────────────────────────

export interface ProdutorAddress {
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  /** Latitude decimal — usada para geofiltro no consumidor */
  lat?: number
  /** Longitude decimal */
  lng?: number
}

// ──────────────────────────────────────────────────────
//  Horário de funcionamento
// ──────────────────────────────────────────────────────

/**
 * dayOfWeek: 0 = domingo … 6 = sábado (padrão JS Date)
 * openTime / closeTime: "HH:mm" em horário local do produtor
 */
export interface ProdutorHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  open: boolean
  openTime?: string
  closeTime?: string
}

// ──────────────────────────────────────────────────────
//  Entidade principal — Produtor (horta)
// ──────────────────────────────────────────────────────

export interface Produtor {
  id: string
  /** Identificador URL-friendly único: "horta-do-joao" */
  slug: string
  /** Nome público da horta */
  name: string
  description: string
  /** Firebase Auth UID do proprietário */
  ownerUid: string

  // Contato
  phone: string
  email?: string
  website?: string

  // Localização
  address: ProdutorAddress

  // Visual
  logoUrl?: string
  bannerUrl?: string

  // Operação
  /** true = aceitando pedidos neste momento */
  isOpen: boolean
  openingHours: ProdutorHours[]
  /** Taxa de entrega em centavos */
  deliveryFeeInCents: number
  /** Taxa adicional por km além da base (0 = taxa fixa) */
  deliveryFeePerKmInCents?: number
  /** Valor mínimo de pedido em centavos */
  minOrderValueInCents: number
  /** Tempo mínimo estimado de entrega (minutos) */
  estimatedDeliveryTimeMin: number
  /** Tempo máximo estimado de entrega (minutos) */
  estimatedDeliveryTimeMax: number
  /** Raio de entrega em km (null = sem restrição) */
  deliveryRadiusKm?: number | null

  // Perfil / legal
  /** CPF ou CNPJ (sem formatação) */
  document?: string
  certifications: ProdutorCertification[]
  /** Tags livres para busca: 'verduras', 'frutas', 'ervas' … */
  tags?: string[]

  /** Horta à qual este produtor pertence (null = produtor independente) */
  hortaId?: string | null

  // Plataforma
  status: ProdutorStatus
  /** % de comissão da plataforma — definida pelo admin */
  commission: number
  /** True quando o admin registrou a conta Mercado Pago deste produtor */
  mpConnected?: boolean
  approvedAt?: Timestamp
  approvedBy?: string
  rejectedAt?: Timestamp
  rejectionReason?: string

  createdAt: Timestamp
  updatedAt: Timestamp
}
