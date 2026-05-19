import type { Timestamp } from 'firebase/firestore'

// ──────────────────────────────────────────────────────
//  Unidade de medida
// ──────────────────────────────────────────────────────

export type ProductUnit =
  | 'kg'
  | 'g'
  | 'unidade'
  | 'maco'
  | 'duzia'
  | 'litro'
  | 'ml'
  | 'caixa'
  | 'bandeja'
  | 'pote'

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  kg:      'kg',
  g:       'g',
  unidade: 'un.',
  maco:    'maço',
  duzia:   'dúzia',
  litro:   'L',
  ml:      'ml',
  caixa:   'cx.',
  bandeja: 'bdj.',
  pote:    'pote',
}

// ──────────────────────────────────────────────────────
//  Categoria de produtos
// ──────────────────────────────────────────────────────

export interface Category {
  id: string
  /** ID do produtor dono desta categoria */
  produtorId: string
  name: string
  description?: string
  /** Ordem de exibição no catálogo */
  order: number
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ──────────────────────────────────────────────────────
//  Produto
// ──────────────────────────────────────────────────────

export interface Product {
  id: string
  produtorId: string
  categoryId: string

  name: string
  description?: string

  /** Preço em centavos */
  priceInCents: number
  /** Preço original em centavos (exibido riscado quando há desconto) */
  compareAtPriceInCents?: number

  photoUrl?: string

  unit: ProductUnit
  /** false = esgotado / pausado pelo produtor */
  available: boolean
  /** Estoque disponível; null = ilimitado */
  stock?: number | null

  isOrganic: boolean
  certifications?: string[]
  /** Tags livres: 'sem glúten', 'vegano', 'colhido hoje' … */
  tags?: string[]

  /** Ordem de exibição dentro da categoria */
  order: number

  createdAt: Timestamp
  updatedAt: Timestamp
}
