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
import { memo, useCallback, useEffect, useMemo, useState } from 'react'

type SerializableProdutor = Omit<Produtor, 'createdAt' | 'updatedAt'>
type SerializableHorta = Omit<Horta, 'createdAt' | 'updatedAt'> | null
type SerializableCategory = Omit<Category, 'createdAt' | 'updatedAt'>
type SerializableProduct = Omit<Product, 'createdAt' | 'updatedAt'>

interface Props {
  produtor: SerializableProdutor
  initialCategories: SerializableCategory[]
  initialProducts: SerializableProduct[]
  horta: SerializableHorta
  /** Modo demonstração: dispensa a conta Stripe do produtor */
  demoMode?: boolean
}

export default function ProdutorCatalog({
  produtor,
  initialCategories,
  initialProducts,
  horta,
  demoMode = false,
}: Props) {
  // Only subscribe to ACTIONS — this component never re-renders due to cart DATA changes
  const { addItem, clearCart, openCart } = useCartActions()
  const [categories, setCategories] = useState<SerializableCategory[]>(initialCategories)
  const [allProducts, setAllProducts] = useState<SerializableProduct[]>(initialProducts)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(
    initialCategories[0]?.id ?? null,
  )
  const [conflictProduct, setConflictProduct] = useState<SerializableProduct | null>(null)

  useEffect(() => {
    const unsub = subscribeToCategories(produtor.id, (cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev ?? cats[0]?.id ?? null)
    })
    return unsub
  }, [produtor.id])

  useEffect(() => {
    const unsub = subscribeToProducts(produtor.id, setAllProducts)
    return unsub
  }, [produtor.id])

  // Stable cartHorta object — recomputed only when horta/produtor props change
  const cartHorta = useMemo<CartHorta>(() => {
    if (horta) {
      return {
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
      }
    }
    return {
      id: produtor.id,
      slug: produtor.slug,
      name: produtor.name,
      deliveryFeeInCents: produtor.deliveryFeeInCents,
      minOrderValueInCents: produtor.minOrderValueInCents,
      estimatedDeliveryTimeMin: produtor.estimatedDeliveryTimeMin,
      estimatedDeliveryTimeMax: produtor.estimatedDeliveryTimeMax,
    }
  }, [horta, produtor.id, produtor.slug, produtor.name, produtor.deliveryFeeInCents, produtor.minOrderValueInCents, produtor.estimatedDeliveryTimeMin, produtor.estimatedDeliveryTimeMax])

  // Memoized filter — only recomputes when products or active category changes
  const products = useMemo(
    () => allProducts.filter((p) => p.categoryId === activeCategoryId && p.available),
    [allProducts, activeCategoryId],
  )

  // Só pode vender quem já conectou a conta de recebimento (Stripe).
  // Em modo demonstração, essa exigência é dispensada.
  // O bloqueio definitivo é server-side no createOrder; aqui é a camada de UX.
  const podeReceber = demoMode || produtor.stripeOnboarded === true

  const handleAddItem = useCallback(
    (product: SerializableProduct) => {
      if (!podeReceber) return
      const result = addItem(
        product as Product,
        { id: produtor.id, name: produtor.name },
        cartHorta,
      )
      if (result === 'conflict') {
        setConflictProduct(product)
      } else {
        openCart()
      }
    },
    [addItem, openCart, produtor.id, produtor.name, cartHorta, podeReceber],
  )

  const handleConflictConfirm = useCallback(() => {
    if (!conflictProduct) return
    clearCart()
    addItem(
      conflictProduct as Product,
      { id: produtor.id, name: produtor.name },
      cartHorta,
    )
    setConflictProduct(null)
    openCart()
  }, [addItem, clearCart, openCart, conflictProduct, produtor.id, produtor.name, cartHorta])

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
                onClick={() => setConflictProduct(null)}
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

      {/* Aviso: produtor ainda não habilitado para receber pedidos */}
      {!podeReceber && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este produtor ainda não está disponível para pedidos. Volte em breve.
        </div>
      )}

      {/* Catálogo */}
      {categories.length === 0 ? (
        <div className="py-10 text-center text-sm text-neutral-400">
          Este produtor ainda não cadastrou produtos.
        </div>
      ) : (
        <>
          {/* Tabs de categoria */}
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

          {/* Produtos */}
          {products.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              Nenhum produto nesta categoria.
            </div>
          ) : (
            <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isOpen={produtor.isOpen && podeReceber}
                  onAdd={handleAddItem}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────
//  Card de produto — memoizado para evitar re-render desnecessário
// ──────────────────────────────────────────────────────

const ProductCard = memo(function ProductCard({
  product,
  isOpen,
  onAdd,
}: {
  product: SerializableProduct
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
          <div className="flex h-full w-full items-center justify-center text-2xl">
            🥬
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-neutral-900">
            {product.name}
          </p>
          {product.isOrganic && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
              Org.
            </span>
          )}
        </div>
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
