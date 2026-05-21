'use client'

import {
  getProdutorBySlug,
  getHortaById,
  subscribeToCategories,
  subscribeToProducts,
  useCart,
} from '@marketplace/shared-services'
import type { CartHorta } from '@marketplace/shared-services'
import type { Category, Horta, Product, Produtor, ProdutorCertification } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const CERT_LABELS: Record<ProdutorCertification, string> = {
  organico: 'Orgânico',
  agroecologico: 'Agroecológico',
  natural: 'Natural',
  biodynamico: 'Biodinâmico',
  sem_agrotoxicos: 'Sem agrotóxicos',
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function InfoPill({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
        accent
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-neutral-100 text-neutral-600',
      ].join(' ')}
    >
      {children}
    </span>
  )
}

export default function ProdutorSlugPage() {
  const params = useParams()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  const { addItem, clearCart, openCart } = useCart()

  const [produtor, setProdutor] = useState<Produtor | null | undefined>(undefined)
  const [horta, setHorta] = useState<Horta | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [conflictProduct, setConflictProduct] = useState<Product | null>(null)

  useEffect(() => {
    if (!slug) return
    getProdutorBySlug(slug).then((p) => setProdutor(p ?? null))
  }, [slug])

  // Carrega a Horta quando o produtor é encontrado
  useEffect(() => {
    if (!produtor) return
    if (produtor.hortaId) {
      getHortaById(produtor.hortaId).then(setHorta)
    } else {
      // Produtor sem horta associada — usa ele mesmo como horta virtual
      setHorta(null)
    }
  }, [produtor?.id, produtor?.hortaId])

  useEffect(() => {
    if (!produtor?.id) return
    const unsub = subscribeToCategories(produtor.id, (cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev ?? cats[0]?.id ?? null)
    })
    return unsub
  }, [produtor?.id])

  useEffect(() => {
    if (!produtor?.id) return
    const unsub = subscribeToProducts(produtor.id, setAllProducts)
    return unsub
  }, [produtor?.id])

  // undefined = carregando; null = não encontrado
  if (produtor === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (produtor === null) {
    notFound()
  }

  const products = allProducts.filter((p) => p.categoryId === activeCategoryId)

  function buildCartHorta(): CartHorta {
    // Se o produtor pertence a uma Horta, usa os dados da Horta.
    // Caso contrário, usa o próprio produtor como horta virtual (backward compat).
    if (horta) {
      return {
        id: horta.id,
        slug: horta.slug,
        name: horta.name,
        deliveryFeeInCents: horta.deliveryFeeInCents,
        minOrderValueInCents: horta.minOrderValueInCents,
        estimatedDeliveryTimeMin: horta.estimatedDeliveryTimeMin,
        estimatedDeliveryTimeMax: horta.estimatedDeliveryTimeMax,
      }
    }
    return {
      id: produtor!.id,
      slug: produtor!.slug,
      name: produtor!.name,
      deliveryFeeInCents: produtor!.deliveryFeeInCents,
      minOrderValueInCents: produtor!.minOrderValueInCents,
      estimatedDeliveryTimeMin: produtor!.estimatedDeliveryTimeMin,
      estimatedDeliveryTimeMax: produtor!.estimatedDeliveryTimeMax,
    }
  }

  function handleAddItem(product: Product) {
    if (!produtor) return
    const result = addItem(
      product,
      { id: produtor.id, name: produtor.name },
      buildCartHorta(),
    )
    if (result === 'conflict') {
      setConflictProduct(product)
    } else {
      openCart()
    }
  }

  function handleConflictConfirm() {
    if (!conflictProduct || !produtor) return
    clearCart()
    addItem(conflictProduct, { id: produtor.id, name: produtor.name }, buildCartHorta())
    setConflictProduct(null)
    openCart()
  }

  const minOrder =
    produtor.minOrderValueInCents === 0
      ? null
      : `Pedido mínimo R$ ${(produtor.minOrderValueInCents / 100).toFixed(2).replace('.', ',')}`

  const feeLabel =
    produtor.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(produtor.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`

  return (
    <div>
      {/* Banner de horta — exibido quando o produtor pertence a uma horta */}
      {horta && (
        <div className="border-b border-brand-100 bg-brand-50 px-4 py-3">
          <p className="mx-auto max-w-4xl text-sm text-brand-700">
            <svg
              className="mr-1.5 inline h-4 w-4 align-text-bottom"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Este produtor faz parte da{' '}
            <Link
              href={`/horta/${horta.slug}`}
              className="font-semibold underline underline-offset-2 hover:text-brand-900"
            >
              Horta {horta.name}
            </Link>
            {' '}— compre de vários produtores em um só pedido.
          </p>
        </div>
      )}

      {/* Modal de conflito de produtor */}
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
        {produtor.bannerUrl ? (
          <Image
            src={produtor.bannerUrl}
            alt={`Banner de ${produtor.name}`}
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

      {/* Cabeçalho do produtor */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6">
        {/* Logo */}
        <div className="-mt-10 mb-4 flex items-end gap-4">
          <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-4 border-white shadow-md">
            {produtor.logoUrl ? (
              <Image
                src={produtor.logoUrl}
                alt={`Logo de ${produtor.name}`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-brand-500 text-2xl font-bold text-white">
                {produtor.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="pb-1">
            <h1 className="text-xl font-bold text-neutral-900 sm:text-2xl">{produtor.name}</h1>
            <p className="text-sm text-neutral-500">
              {produtor.address.neighborhood}, {produtor.address.city} — {produtor.address.state}
            </p>
          </div>
        </div>

        {/* Descrição */}
        {produtor.description && (
          <p className="mb-4 text-sm text-neutral-600">{produtor.description}</p>
        )}

        {/* Pills de info */}
        <div className="mb-4 flex flex-wrap gap-2">
          <InfoPill accent={produtor.isOpen}>
            <span
              className={[
                'h-1.5 w-1.5 rounded-full',
                produtor.isOpen ? 'bg-emerald-500' : 'bg-neutral-400',
              ].join(' ')}
              aria-hidden="true"
            />
            {produtor.isOpen ? 'Aberto agora' : 'Fechado'}
          </InfoPill>

          <InfoPill>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {produtor.estimatedDeliveryTimeMin}–{produtor.estimatedDeliveryTimeMax} min
          </InfoPill>

          <InfoPill>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1.33 9.326A2 2 0 008.32 19h7.36a2 2 0 001.99-1.674L19 8" />
            </svg>
            {feeLabel}
          </InfoPill>

          {minOrder && <InfoPill>{minOrder}</InfoPill>}
        </div>

        {/* Certificações */}
        {produtor.certifications.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {produtor.certifications.map((cert) => (
              <span
                key={cert}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
              >
                {CERT_LABELS[cert]}
              </span>
            ))}
          </div>
        )}

        {/* Horários (colapsável) */}
        <div className="mb-6 rounded-xl border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => setHoursOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700"
            aria-expanded={hoursOpen}
          >
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Horários de atendimento
            </span>
            <svg
              className={['h-4 w-4 text-neutral-400 transition-transform', hoursOpen ? 'rotate-180' : ''].join(' ')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {hoursOpen && (
            <div className="border-t border-neutral-100 px-4 py-2">
              {produtor.openingHours.map((h) => (
                <div
                  key={h.dayOfWeek}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className={h.open ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
                    {DAYS[h.dayOfWeek]}
                  </span>
                  <span className={h.open ? 'text-neutral-700' : 'text-neutral-400'}>
                    {h.open ? `${h.openTime} – ${h.closeTime}` : 'Fechado'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
                {products.filter((p) => p.available).map((product) => (
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
                      disabled={!produtor.isOpen}
                      title={produtor.isOpen ? 'Adicionar ao carrinho' : 'Produtor fechado no momento'}
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
  )
}
