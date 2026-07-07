'use client'

import {
  subscribeToCategories,
  subscribeToProducts,
  useCartActions,
} from '@marketplace/shared-services'
import type { CartHorta } from '@marketplace/shared-services'
import type { Category, Horta, Product, Produtor } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import Image from 'next/image'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

type SerializableHorta = Omit<Horta, 'createdAt' | 'updatedAt'>
type SerializableProdutor = Omit<Produtor, 'createdAt' | 'updatedAt'>
type SerializableCategory = Omit<Category, 'createdAt' | 'updatedAt'>
type SerializableProduct = Omit<Product, 'createdAt' | 'updatedAt'>

const TODOS_TAB = '__todos__'

interface Props {
  horta: SerializableHorta
  initialProdutores: SerializableProdutor[]
  initialCategories: SerializableCategory[]
  initialProducts: SerializableProduct[]
  /** Modo demonstração: dispensa a conta Stripe dos produtores */
  demoMode?: boolean
}

export default function HortaCatalog({
  horta,
  initialProdutores,
  initialCategories,
  initialProducts,
  demoMode = false,
}: Props) {
  // Only subscribe to ACTIONS — catalog doesn't need cart data, only functions
  const { addItem, clearCart, openCart } = useCartActions()
  const [produtores] = useState<SerializableProdutor[]>(initialProdutores)
  const [activeTab, setActiveTab] = useState<string>(TODOS_TAB)

  // Per-producer tab state
  const [categories, setCategories] = useState<SerializableCategory[]>(initialCategories)
  const [produtorProducts, setProdutorProducts] = useState<SerializableProduct[]>(initialProducts)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  )

  // TODOS tab state — lazily loaded only when TODOS tab becomes active
  const [todosProducts, setTodosProducts] = useState<SerializableProduct[]>([])
  const [todosLoaded, setTodosLoaded] = useState(false)
  const todosProductsRef = useRef<Map<string, SerializableProduct[]>>(new Map())

  const [conflictProduct, setConflictProduct] = useState<SerializableProduct | null>(null)
  const [conflictProdutor, setConflictProdutor] = useState<SerializableProdutor | null>(null)

  // Stable cartHorta — only recomputed when horta identity changes
  const cartHorta = useMemo<CartHorta>(() => ({
    id: horta.id,
    slug: horta.slug,
    name: horta.name,
    deliveryFeeInCents: horta.deliveryFeeInCents,
    ...(horta.deliveryFeePerKmInCents ? { deliveryFeePerKmInCents: horta.deliveryFeePerKmInCents } : {}),
    ...(horta.deliveryRadiusKm != null ? { deliveryRadiusKm: horta.deliveryRadiusKm } : {}),
    ...(horta.lat ? { lat: horta.lat } : {}),
    ...(horta.lng ? { lng: horta.lng } : {}),
    minOrderValueInCents: horta.minOrderValueInCents,
    estimatedDeliveryTimeMin: horta.estimatedDeliveryTimeMin,
    estimatedDeliveryTimeMax: horta.estimatedDeliveryTimeMax,
  }), [horta.id, horta.slug, horta.name, horta.deliveryFeeInCents, horta.deliveryFeePerKmInCents, horta.deliveryRadiusKm, horta.lat, horta.lng, horta.minOrderValueInCents, horta.estimatedDeliveryTimeMin, horta.estimatedDeliveryTimeMax])

  // TODOS products — only subscribe when the TODOS tab is first activated (lazy load)
  // This avoids N simultaneous Firestore connections on every page mount
  useEffect(() => {
    if (activeTab !== TODOS_TAB || todosLoaded) return
    if (produtores.length === 0) return

    setTodosLoaded(true)
    todosProductsRef.current = new Map()

    const unsubs = produtores.map((p) =>
      subscribeToProducts(p.id, (prods) => {
        todosProductsRef.current.set(p.id, prods)
        // Rebuild merged array once per producer update
        setTodosProducts([...todosProductsRef.current.values()].flat())
      }),
    )

    return () => unsubs.forEach((u) => u())
  }, [activeTab, todosLoaded, produtores])

  // Per-producer tab — subscribe to categories and products for the active producer
  useEffect(() => {
    if (activeTab === TODOS_TAB || !activeTab) return
    setCategories([])
    setProdutorProducts([])
    setActiveCategoryId(null)

    const unsubCats = subscribeToCategories(activeTab, (cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev ?? cats[0]?.id ?? null)
    })
    const unsubProds = subscribeToProducts(activeTab, setProdutorProducts)

    return () => {
      unsubCats()
      unsubProds()
    }
  }, [activeTab])

  const activeProdutor = useMemo(
    () => produtores.find((p) => p.id === activeTab),
    [produtores, activeTab],
  )

  // Memoized filters — only recompute when their inputs change
  const produtorFilteredProducts = useMemo(
    () => produtorProducts.filter((p) => p.categoryId === activeCategoryId && p.available),
    [produtorProducts, activeCategoryId],
  )

  const todosFilteredProducts = useMemo(
    () => todosProducts.filter((p) => p.available),
    [todosProducts],
  )

  // Producer lookup map for TODOS tab — avoids O(n) find on each card render
  const produtorMap = useMemo(
    () => new Map(produtores.map((p) => [p.id, p])),
    [produtores],
  )

  const handleAddItem = useCallback(
    (product: SerializableProduct) => {
      const produtor = activeTab === TODOS_TAB
        ? produtorMap.get(product.produtorId ?? '')
        : activeProdutor
      if (!produtor) return
      // Só pode vender quem conectou a conta de recebimento (Stripe).
      // Em modo demonstração, essa exigência é dispensada.
      if (!demoMode && produtor.stripeOnboarded !== true) return

      const result = addItem(product as Product, { id: produtor.id, name: produtor.name }, cartHorta)
      if (result === 'conflict') {
        setConflictProduct(product)
        setConflictProdutor(produtor)
      } else {
        openCart()
      }
    },
    [addItem, openCart, activeTab, activeProdutor, produtorMap, cartHorta, demoMode],
  )

  const handleConflictConfirm = useCallback(() => {
    if (!conflictProduct || !conflictProdutor) return
    clearCart()
    addItem(
      conflictProduct as Product,
      { id: conflictProdutor.id, name: conflictProdutor.name },
      cartHorta,
    )
    setConflictProduct(null)
    setConflictProdutor(null)
    openCart()
  }, [addItem, clearCart, openCart, conflictProduct, conflictProdutor, cartHorta])

  return (
    <>
      {/* Modal de conflito */}
      {conflictProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-neutral-900">Trocar de horta?</h2>
            <p className="mb-5 text-sm text-neutral-500">
              Seu carrinho tem itens de outra horta. Ao continuar, os itens anteriores serão
              removidos.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setConflictProduct(null); setConflictProdutor(null) }}
                className="flex-1 rounded-xl border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConflictConfirm}
                className="flex-1 rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Trocar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs: Todos + por produtor */}
      <div className="mb-0 border-b border-neutral-200">
        <div className="flex gap-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab(TODOS_TAB)}
            className={[
              'flex flex-shrink-0 items-center gap-1.5 border-b-2 px-5 py-3 text-sm font-medium transition-colors',
              activeTab === TODOS_TAB
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700',
            ].join(' ')}
          >
            Todos
            {todosFilteredProducts.length > 0 && (
              <span className={[
                'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                activeTab === TODOS_TAB ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-500',
              ].join(' ')}>
                {todosFilteredProducts.length}
              </span>
            )}
          </button>

          {produtores.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setActiveTab(p.id)
                setActiveCategoryId(null)
              }}
              className={[
                'flex flex-shrink-0 items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors',
                activeTab === p.id
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              <span
                className={[
                  'h-2 w-2 rounded-full',
                  p.isOpen ? 'bg-emerald-500' : 'bg-neutral-300',
                ].join(' ')}
                aria-hidden="true"
              />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aba Todos ── */}
      {activeTab === TODOS_TAB && (
        <div className="mt-4">
          {todosFilteredProducts.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              {!todosLoaded || todosProducts.length === 0
                ? 'Carregando produtos…'
                : 'Nenhum produto disponível no momento.'}
            </div>
          ) : (
            <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {todosFilteredProducts.map((product) => {
                const produtor = produtorMap.get(product.produtorId ?? '')
                return (
                  <ProductCard
                    key={product.id}
                    product={product}
                    produtorName={produtor?.name}
                    isOpen={(produtor?.isOpen ?? false) && (demoMode || produtor?.stripeOnboarded === true)}
                    onAdd={handleAddItem}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Aba por produtor ── */}
      {activeTab !== TODOS_TAB && (
        <div className="mt-4">
          {activeProdutor && !activeProdutor.isOpen && (
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <strong>{activeProdutor.name}</strong> está fechado no momento. Você ainda pode ver o
              catálogo, mas não pode fazer pedidos.
            </div>
          )}

          {activeProdutor && activeProdutor.isOpen && !demoMode && activeProdutor.stripeOnboarded !== true && (
            <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <strong>{activeProdutor.name}</strong> ainda não está disponível para pedidos.
            </div>
          )}

          {categories.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              {activeProdutor
                ? `${activeProdutor.name} ainda não cadastrou produtos.`
                : 'Carregando catálogo...'}
            </div>
          ) : (
            <>
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={[
                      'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                      activeCategoryId === cat.id
                        ? 'bg-brand-500 text-white'
                        : 'border border-neutral-300 bg-white text-neutral-600 hover:border-brand-400',
                    ].join(' ')}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {produtorFilteredProducts.length === 0 ? (
                <div className="py-10 text-center text-sm text-neutral-400">
                  Nenhum produto nesta categoria.
                </div>
              ) : (
                <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {produtorFilteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isOpen={(activeProdutor?.isOpen ?? false) && (demoMode || activeProdutor?.stripeOnboarded === true)}
                      onAdd={handleAddItem}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────
//  Card de produto — memoizado para evitar re-render desnecessário
// ──────────────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  product,
  produtorName,
  isOpen,
  onAdd,
}: {
  product: SerializableProduct
  produtorName?: string
  isOpen: boolean
  onAdd: (p: SerializableProduct) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
        {product.photoUrl ? (
          <Image
            src={product.photoUrl}
            alt={product.name}
            width={64}
            height={64}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🥬</div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="truncate text-sm font-semibold text-neutral-900">{product.name}</p>
          {product.isOrganic && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              Org.
            </span>
          )}
        </div>
        {produtorName && (
          <p className="text-xs text-brand-600 font-medium truncate">{produtorName}</p>
        )}
        {product.description && (
          <p className="truncate text-xs text-neutral-500">{product.description}</p>
        )}
        <p className="mt-1 text-sm font-bold text-brand-600">
          {(product.priceInCents / 100).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
          })}
          <span className="ml-1 text-xs font-normal text-neutral-400">
            / {PRODUCT_UNIT_LABELS[product.unit]}
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => onAdd(product)}
        disabled={!isOpen}
        title={isOpen ? 'Adicionar ao carrinho' : 'Produtor fechado no momento'}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Adicionar ${product.name} ao carrinho`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
})
