import type { Timestamp } from 'firebase/firestore'
import type { ProductUnit } from './product'

// ──────────────────────────────────────────────────────
//  Endereço de entrega
// ──────────────────────────────────────────────────────

export interface Address {
  id: string
  userId: string
  label: string          // "Casa", "Trabalho", "Outro"
  recipientName: string
  phone: string
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
  reference?: string
  lat?: number
  lng?: number
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ──────────────────────────────────────────────────────
//  Cupom
// ──────────────────────────────────────────────────────

export type CouponType = 'percentage' | 'fixed'

export interface Coupon {
  code: string
  type: CouponType
  /** Percentual (0-100) ou centavos, conforme type */
  value: number
  minOrderValueInCents?: number
  maxDiscountInCents?: number
  produtorId?: string | null
  maxUses?: number | null
  usedCount: number
  validFrom: Timestamp
  validUntil: Timestamp
  active: boolean
  createdAt: Timestamp
}

// ──────────────────────────────────────────────────────
//  Item do pedido
// ──────────────────────────────────────────────────────

export interface OrderItem {
  productId: string
  productName: string
  categoryId: string
  categoryName: string
  unit: ProductUnit
  priceInCents: number
  quantity: number
  photoUrl?: string
  notes?: string
}

// ──────────────────────────────────────────────────────
//  Status do pedido
// ──────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'       // aguardando pagamento
  | 'confirmed'     // pagamento confirmado
  | 'accepted'      // produtor aceitou
  | 'preparing'     // em preparo
  | 'ready'         // pronto / aguardando entregador
  | 'on_delivery'   // saiu para entrega
  | 'delivered'     // entregue
  | 'cancelled'     // cancelado
  | 'refunded'      // estornado

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:     'Aguardando pagamento',
  confirmed:   'Pagamento confirmado',
  accepted:    'Pedido aceito',
  preparing:   'Em preparo',
  ready:       'Pronto',
  on_delivery: 'Saiu para entrega',
  delivered:   'Entregue',
  cancelled:   'Cancelado',
  refunded:    'Estornado',
}

export interface StatusHistoryEntry {
  status: OrderStatus
  timestamp: Timestamp
  note?: string
}

// ──────────────────────────────────────────────────────
//  Pagamento
// ──────────────────────────────────────────────────────

export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card'
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'

export interface Payment {
  method: PaymentMethod
  status: PaymentStatus
  externalId?: string
  pixQrCodeBase64?: string
  pixQrCode?: string
  paidAt?: Timestamp
}

// ──────────────────────────────────────────────────────
//  Snapshot de endereço no pedido
// ──────────────────────────────────────────────────────

export interface DeliveryAddress {
  label: string
  recipientName: string
  phone: string
  cep: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string
}

// ──────────────────────────────────────────────────────
//  Pedido
// ──────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────
//  Pedido Filho (por produtor dentro de um pedido de horta)
// ──────────────────────────────────────────────────────

export type FilhoStatus = 'pendente' | 'aceito' | 'em_preparo' | 'separado' | 'cancelado'

export const FILHO_STATUS_LABELS: Record<FilhoStatus, string> = {
  pendente:   'Aguardando',
  aceito:     'Aceito',
  em_preparo: 'Em preparo',
  separado:   'Separado',
  cancelado:  'Cancelado',
}

export interface PedidoFilho {
  id: string
  /** ID do documento em orders/ (pedido pai) */
  pedidoPaiId: string
  hortaId: string
  produtorId: string
  produtorName: string
  /** Snapshot do cliente para exibição no kanban do produtor */
  customerId: string
  customerName: string
  customerPhone: string
  deliveryAddress: DeliveryAddress
  status: FilhoStatus
  /** Valor a repassar ao produtor, em centavos */
  valorRepasseInCents: number
  items: OrderItem[]
  /** Controle de repasse financeiro */
  repassePago?: boolean
  repassePagoAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ──────────────────────────────────────────────────────
//  Pedido (Pedido Pai quando hortaId está presente)
// ──────────────────────────────────────────────────────

export interface Order {
  id: string

  customerId: string
  customerName: string
  customerPhone: string

  /** Presente em pedidos do modelo legado (um único produtor) */
  produtorId: string
  produtorName: string
  produtorSlug: string

  /** Presente nos novos pedidos de horta (multi-produtor) */
  hortaId?: string
  /** Quantos PedidoFilho este pedido tem */
  pedidoFilhosCount?: number

  items: OrderItem[]
  deliveryAddress: DeliveryAddress

  subtotalInCents: number
  deliveryFeeInCents: number
  discountInCents: number
  totalInCents: number

  couponCode?: string
  payment: Payment
  status: OrderStatus
  statusHistory: StatusHistoryEntry[]

  deliveryDriverId?: string
  notes?: string

  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number

  createdAt: Timestamp
  confirmedAt?: Timestamp
  acceptedAt?: Timestamp
  preparingAt?: Timestamp
  readyAt?: Timestamp
  onDeliveryAt?: Timestamp
  deliveredAt?: Timestamp
  cancelledAt?: Timestamp
}
