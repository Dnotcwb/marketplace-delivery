'use client'

import type { Product } from '@marketplace/shared-types'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

// ──────────────────────────────────────────────────────
//  Tipos
// ──────────────────────────────────────────────────────

export interface CartHorta {
  id: string
  slug: string
  name: string
  /** Origem do carrinho: 'horta' (coletivo) ou 'produtor' (avulso). Define a URL de "voltar ao catálogo". */
  type?: 'horta' | 'produtor'
  deliveryFeeInCents: number
  deliveryFeePerKmInCents?: number
  deliveryRadiusKm?: number | null
  lat?: number
  lng?: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
}

/** @deprecated Use CartHorta. */
export type CartProdutor = CartHorta

export interface CartItem {
  product: Product
  produtorId: string
  produtorName: string
  quantity: number
  notes?: string
}

export interface CartState {
  horta: CartHorta | null
  items: CartItem[]
}

// Context split: DATA (changes on every cart mutation) vs ACTIONS (stable refs)
// Components that only need addItem/openCart subscribe to ACTIONS only → no re-render on data changes.

interface CartDataValue {
  horta: CartHorta | null
  items: CartItem[]
  itemCount: number
  subtotalInCents: number
  isOpen: boolean
}

interface CartActionsValue {
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
  openCart: () => void
  closeCart: () => void
}

export interface CartContextValue extends CartDataValue, CartActionsValue {}

// ──────────────────────────────────────────────────────
//  Contexts
// ──────────────────────────────────────────────────────

const CartDataContext = createContext<CartDataValue | null>(null)
const CartActionsContext = createContext<CartActionsValue | null>(null)

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
    // quota exceeded
  }
}

// ──────────────────────────────────────────────────────
//  Provider
// ──────────────────────────────────────────────────────

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CartState>({ horta: null, items: [] })
  const [isOpen, setIsOpen] = useState(false)
  const stateRef = useRef(state)

  // Keep ref in sync without causing re-renders
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Hydrate from storage once on mount
  const hydratedRef = useRef(false)
  useEffect(() => {
    const saved = loadFromStorage()
    // Only update if storage has actual data
    if (saved.horta || saved.items.length > 0) {
      setState(saved)
    }
    hydratedRef.current = true
  }, [])

  // Debounced localStorage save — avoids blocking the thread on rapid quantity taps
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    // Não salva antes de hidratar (evita sobrescrever o storage no mount).
    // Depois de hidratado, persiste QUALQUER estado — inclusive o vazio. Sem
    // isso, remover o último item não era salvo e ele "voltava" ao recarregar.
    if (!hydratedRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveToStorage(state)
    }, 300)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [state])

  // ── Stable action callbacks ────────────────────────────────────────────────

  // addItem reads horta from ref so it never needs to change reference
  const addItem = useCallback(
    (
      product: Product,
      produtorInfo: { id: string; name: string },
      horta: CartHorta,
      notes?: string,
    ): 'ok' | 'conflict' => {
      const currentHorta = stateRef.current.horta
      if (currentHorta && currentHorta.id !== horta.id) {
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
    [], // No deps — reads horta from ref
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
    // Cancela qualquer save pendente e apaga o storage explicitamente.
    // O efeito de save ignora o estado vazio (para não sobrescrever o carrinho
    // antes da hidratação), então sem o removeItem abaixo o localStorage
    // manteria os itens antigos e o carrinho "voltaria" após finalizar o pedido.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setState({ horta: null, items: [] })
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  // ── Memoized values ───────────────────────────────────────────────────────

  const itemCount = useMemo(
    () => state.items.reduce((sum, i) => sum + i.quantity, 0),
    [state.items],
  )

  const subtotalInCents = useMemo(
    () => state.items.reduce((sum, i) => sum + i.product.priceInCents * i.quantity, 0),
    [state.items],
  )

  // Actions value is stable — only changes if callbacks change (which they don't)
  const actionsValue = useMemo<CartActionsValue>(
    () => ({ addItem, removeItem, updateQuantity, updateNotes, clearCart, openCart, closeCart }),
    [addItem, removeItem, updateQuantity, updateNotes, clearCart, openCart, closeCart],
  )

  // Data value changes when cart state or drawer state changes
  const dataValue = useMemo<CartDataValue>(
    () => ({ horta: state.horta, items: state.items, itemCount, subtotalInCents, isOpen }),
    [state.horta, state.items, itemCount, subtotalInCents, isOpen],
  )

  return (
    <CartActionsContext.Provider value={actionsValue}>
      <CartDataContext.Provider value={dataValue}>
        {children}
      </CartDataContext.Provider>
    </CartActionsContext.Provider>
  )
}

// ──────────────────────────────────────────────────────
//  Hooks
// ──────────────────────────────────────────────────────

/** Full cart access. Re-renders on any cart or drawer state change. */
export function useCart(): CartContextValue {
  const data = useContext(CartDataContext)
  const actions = useContext(CartActionsContext)
  if (!data || !actions) throw new Error('useCart deve ser usado dentro de <CartProvider>')
  return useMemo(() => ({ ...data, ...actions }), [data, actions])
}

/**
 * Cart actions only — stable references, does NOT re-render when cart data changes.
 * Use in catalog components that only need addItem/openCart/clearCart.
 */
export function useCartActions(): CartActionsValue {
  const actions = useContext(CartActionsContext)
  if (!actions) throw new Error('useCartActions deve ser usado dentro de <CartProvider>')
  return actions
}

/**
 * Cart data only — re-renders on data changes.
 * Use in components that display cart contents (Header badge, CartDrawer).
 */
export function useCartData(): CartDataValue {
  const data = useContext(CartDataContext)
  if (!data) throw new Error('useCartData deve ser usado dentro de <CartProvider>')
  return data
}
