'use client'

import {
  getHortaBySlug,
  getProdutorById,
  subscribeToCategories,
  subscribeToProducts,
  useCart,
} from '@marketplace/shared-services'
import type { CartHorta } from '@marketplace/shared-services'
import type { Category, Horta, Product, Produtor } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

function InfoPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
      {children}
    </span>
  )
}

export default function HortaSlugPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const { addItem, clearCart, openCart } = useCart()

  const [horta, setHorta] = useState<Horta | null | undefined>(undefined)
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [activeTab, setActiveTab] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [conflictProduct, setConflictProduct] = useState<Product | null>(null)

  // Carrega a horta pelo slug
  useEffect(() => {
    if (!slug) return
    getHortaBySlug(slug).then((h) => setHorta(h ?? null))
  }, [slug])

  // Carrega todos os produtores da horta em paralelo
  useEffect(() => {
    if (!horta) return
    if (horta.produtorIds.length === 0) {
      setProdutores([])
      return
    }
    Promise.all(horta.produtorIds.map((id) => getProdutorById(id))).then((results) => {
      const valid = results.filter((p): p is Produtor => p !== null)
      setProdutores(valid)
      setActiveTab((prev) => prev || valid[0]?.id || '')
    })
  }, [horta?.id])

  // Subscreve categorias e produtos do produtor ativo
  useEffect(() => {
    if (!activeTab) return
    setCategories([])
    setAllProducts([])
    setActiveCategoryId(null)

    const unsubCats = subscribeToCategories(activeTab, (cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev ?? cats[0]?.id ?? null)
    })
    const unsubProds = subscribeToProducts(activeTab, setAllProducts)

    return () => {
      unsubCats()
      unsubProds()
    }
  }, [activeTab])

  if (horta === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (horta === null) notFound()

  const activeProdutor = produtores.find((p) => p.id === activeTab)
  const products = allProducts.filter((p) => p.categoryId === activeCategoryId && p.available)

  const cartHorta: CartHorta = {
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

  function handleAddItem(product: Product) {
    if (!activeProdutor) return
    const result = addItem(product, { id: activeProdutor.id, name: activeProdutor.name }, cartHorta)
    if (result === 'conflict') {
      setConflictProduct(product)
    } else {
      openCart()
    }
  }

  function handleConflictConfirm() {
    if (!conflictProduct || !activeProdutor) return
    clearCart()
    addItem(conflictProduct, { id: activeProdutor.id, name: activeProdutor.name }, cartHorta)
    setConflictProduct(null)
    openCart()
  }

  const feeLabel =
    horta.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`

  return (
    <div>
      {/* Modal de conflito */}
      {conflictProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-neutral-900">Trocar de horta?</h2>
            <p className="mb-5 text-sm text-neutral-500">
              Seu carrinho tem itens de outra horta. Ao continuar, os itens anteriores serão removidos.
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

      {/* Banner */}
      <div className="relative isolate h-48 w-full overflow-hidden bg-neutral-200 sm:h-64">
        {horta.bannerUrl ? (
          <Image
            src={horta.bannerUrl}
            alt={`Banner de ${horta.name}`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300">
            <span className="text-8xl opacity-30">🌿</span>
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6">
        {/* Logo + nome */}
        <div className="-mt-10 mb-4 flex items-end gap-4">
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-4 border-white shadow-md">
            {horta.logoUrl ? (
              <Image
                src={horta.logoUrl}
                alt={`Logo de ${horta.name}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-brand-500 text-2xl font-bold text-white">
                {horta.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{horta.name}</h1>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                Horta
              </span>
            </div>
            <p className="text-sm text-neutral-500">
              {horta.address.neighborhood}, {horta.address.city} — {horta.address.state}
            </p>
          </div>
        </div>

        {/* Descrição */}
        {horta.description && (
          <p className="mb-4 text-sm text-neutral-600">{horta.description}</p>
        )}

        {/* Pills de info */}
        <div className="mb-6 flex flex-wrap gap-2">
          <InfoPill>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {horta.estimatedDeliveryTimeMin}–{horta.estimatedDeliveryTimeMax} min
          </InfoPill>
          <InfoPill>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1.33 9.326A2 2 0 008.32 19h7.36a2 2 0 001.99-1.674L19 8" />
            </svg>
            {feeLabel}
          </InfoPill>
          {horta.minOrderValueInCents > 0 && (
            <InfoPill>
              Mínimo R$ {(horta.minOrderValueInCents / 100).toFixed(2).replace('.', ',')}
            </InfoPill>
          )}
          <InfoPill>
            {produtores.length} produtor{produtores.length !== 1 ? 'es' : ''}
          </InfoPill>
        </div>

        {/* Tabs de produtores — só exibe se houver mais de um */}
        {produtores.length > 1 && (
          <div className="mb-0 border-b border-neutral-200">
            <div className="flex gap-0 overflow-x-auto">
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
        )}

        {/* Produtor ativo fechado */}
        {activeProdutor && !activeProdutor.isOpen && (
          <div className="my-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <strong>{activeProdutor.name}</strong> está fechado no momento. Você ainda pode ver o catálogo, mas não pode fazer pedidos.
          </div>
        )}

        {/* Catálogo do produtor ativo */}
        <div className="mt-4">
          {categories.length === 0 ? (
            <div className="py-10 text-center text-sm text-neutral-400">
              {activeProdutor
                ? `${activeProdutor.name} ainda não cadastrou produtos.`
                : 'Carregando catálogo...'}
            </div>
          ) : (
            <>
              {/* Chips de categoria */}
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

              {/* Grade de produtos */}
              {products.length === 0 ? (
                <div className="py-10 text-center text-sm text-neutral-400">
                  Nenhum produto nesta categoria.
                </div>
              ) : (
                <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                    >
                      {/* Foto */}
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

                      {/* Info */}
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

                      {/* Botão adicionar */}
                      <button
                        type="button"
                        onClick={() => handleAddItem(product)}
                        disabled={!activeProdutor?.isOpen}
                        title={
                          activeProdutor?.isOpen
                            ? 'Adicionar ao carrinho'
                            : 'Produtor fechado no momento'
                        }
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Adicionar ${product.name} ao carrinho`}
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
