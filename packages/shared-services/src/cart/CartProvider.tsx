'use client'

import type { Product } from '@marketplace/shared-types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ──────────────────────────────────────────────────────
//  Tipos
// ──────────────────────────────────────────────────────

/** Dados mínimos da Horta necessários para o carrinho. */
export interface CartHorta {
  id: string
  slug: string
  name: string
  deliveryFeeInCents: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
}

/**
 * @deprecated Use CartHorta. Mantido apenas para compatibilidade de tipo
 * com código ainda não migrado.
 */
export type CartProdutor = CartHorta

export interface CartItem {
  product: Product
  /** ID do produtor dono deste item dentro da horta */
  produtorId: string
  produtorName: string
  quantity: number
  notes?: string
}

export interface CartState {
  horta: CartHorta | null
  items: CartItem[]
}

export interface CartContextValue {
  horta: CartHorta | null
  items: CartItem[]
  itemCount: number
  subtotalInCents: number
  /**
   * Adiciona item ao carrinho.
   * Retorna 'conflict' se for de uma horta diferente da atual.
   */
  addItem: (
    product: Product,
    produtorInfo: { id: string; name: string },
    horta: CartHorta,
    notes?: string,
  ) => 'ok' | 'conflict'
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateNotes: (productId: string, notes: string) => void
  clearCart: () => void
  isOpen: boolean
  openCart: () => void
  closeCart: () => void
}

// ──────────────────────────────────────────────────────
//  Context
// ──────────────────────────────────────────────────────

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = 'al_cart_v2'

function loadFromStorage(): CartState {
  if (typeof window === 'undefined') return { horta: null, items: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { horta: null, items: [] }
    return JSON.parse(raw) as CartState
  } catch {
    return { horta: null, items: [] }
  }
}

function saveToStorage(state: CartState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // quota exceeded — ignora
  }
}

// ──────────────────────────────────────────────────────
//  Provider
// ──────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ horta: null, items: [] })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setState(loadFromStorage())
  }, [])

  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const addItem = useCallback(
    (
      product: Product,
      produtorInfo: { id: string; name: string },
      horta: CartHorta,
      notes?: string,
    ): 'ok' | 'conflict' => {
      if (state.horta && state.horta.id !== horta.id) {
        return 'conflict'
      }

      setState((prev) => {
        const existingIdx = prev.items.findIndex(
          (i) => i.product.id === product.id && i.produtorId === produtorInfo.id,
        )
        const items =
          existingIdx >= 0
            ? prev.items.map((item, idx) =>
                idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item,
              )
            : [
                ...prev.items,
                {
                  product,
                  produtorId: produtorInfo.id,
                  produtorName: produtorInfo.name,
                  quantity: 1,
                  ...(notes ? { notes } : {}),
                },
              ]

        return { horta, items }
      })

      return 'ok'
    },
    [state.horta],
  )

  const removeItem = useCallback((productId: string) => {
    setState((prev) => {
      const items = prev.items.filter((i) => i.product.id !== productId)
      return { horta: items.length === 0 ? null : prev.horta, items }
    })
  }, [])

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId)
        return
      }
      setState((prev) => ({
        ...prev,
        items: prev.items.map((i) =>
          i.product.id === productId ? { ...i, quantity } : i,
        ),
      }))
    },
    [removeItem],
  )

  const updateNotes = useCallback((productId: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product.id === productId ? { ...i, notes } : i,
      ),
    }))
  }, [])

  const clearCart = useCallback(() => {
    setState({ horta: null, items: [] })
  }, [])

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotalInCents = state.items.reduce(
    (sum, i) => sum + i.product.priceInCents * i.quantity,
    0,
  )

  return (
    <CartContext.Provider
      value={{
        horta: state.horta,
        items: state.items,
        itemCount,
        subtotalInCents,
        addItem,
        removeItem,
        updateQuantity,
        updateNotes,
        clearCart,
        isOpen,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart deve ser usado dentro de <CartProvider>')
  return ctx
}
