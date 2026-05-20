'use client'

import type { Product } from '@marketplace/shared-types'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ──────────────────────────────────────────────────────
//  Tipos
// ──────────────────────────────────────────────────────

export interface CartProdutor {
  id: string
  slug: string
  name: string
  deliveryFeeInCents: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
}

export interface CartItem {
  product: Product
  quantity: number
  notes?: string
}

export interface CartState {
  produtor: CartProdutor | null
  items: CartItem[]
}

export interface CartContextValue {
  produtor: CartProdutor | null
  items: CartItem[]
  itemCount: number
  subtotalInCents: number
  /** Adiciona item ao carrinho. Retorna 'conflict' se for de outro produtor. */
  addItem: (product: Product, produtor: CartProdutor, notes?: string) => 'ok' | 'conflict'
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

const STORAGE_KEY = 'al_cart'

function loadFromStorage(): CartState {
  if (typeof window === 'undefined') return { produtor: null, items: [] }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { produtor: null, items: [] }
    return JSON.parse(raw) as CartState
  } catch {
    return { produtor: null, items: [] }
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
  const [state, setState] = useState<CartState>({ produtor: null, items: [] })
  const [isOpen, setIsOpen] = useState(false)

  // Carrega do localStorage uma única vez no mount
  useEffect(() => {
    setState(loadFromStorage())
  }, [])

  // Persiste sempre que o estado muda
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const addItem = useCallback(
    (product: Product, produtor: CartProdutor, notes?: string): 'ok' | 'conflict' => {
      // Verifica conflito de produtor
      if (state.produtor && state.produtor.id !== produtor.id) {
        return 'conflict'
      }

      setState((prev) => {
        const existingIdx = prev.items.findIndex((i) => i.product.id === product.id)
        const items =
          existingIdx >= 0
            ? prev.items.map((item, idx) =>
                idx === existingIdx
                  ? { ...item, quantity: item.quantity + 1 }
                  : item,
              )
            : [...prev.items, { product, quantity: 1, ...(notes ? { notes } : {}) }]

        return { produtor, items }
      })

      return 'ok'
    },
    [state.produtor],
  )

  const removeItem = useCallback((productId: string) => {
    setState((prev) => {
      const items = prev.items.filter((i) => i.product.id !== productId)
      return { produtor: items.length === 0 ? null : prev.produtor, items }
    })
  }, [])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
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
  }, [removeItem])

  const updateNotes = useCallback((productId: string, notes: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.product.id === productId ? { ...i, notes } : i,
      ),
    }))
  }, [])

  const clearCart = useCallback(() => {
    setState({ produtor: null, items: [] })
  }, [])

  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0)
  const subtotalInCents = state.items.reduce(
    (sum, i) => sum + i.product.priceInCents * i.quantity,
    0,
  )

  return (
    <CartContext.Provider
      value={{
        produtor: state.produtor,
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
