import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  getProdutorBySlug,
  getHortaById,
  listCategories,
  listProducts,
  listProdutoresAprovados,
  listReviews,
  getPlatformConfig,
} from '@marketplace/shared-services'
import type { ProdutorCertification } from '@marketplace/shared-types'
import ProdutorCatalog from '@/components/ProdutorCatalog'

export const revalidate = 300
export const dynamicParams = true

const CERT_LABELS: Record<ProdutorCertification, string> = {
  organico: 'Orgânico',
  agroecologico: 'Agroecológico',
  natural: 'Natural',
  biodynamico: 'Biodinâmico',
  sem_agrotoxicos: 'Sem agrotóxicos',
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const getProdutor = cache(async (slug: string) => getProdutorBySlug(slug))

export async function generateStaticParams() {
  try {
    const produtores = await listProdutoresAprovados()
    return produtores.map((p) => ({ slug: p.slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const produtor = await getProdutor(slug)
  if (!produtor) return {}
  const description =
    produtor.description || `Produtos frescos direto do campo, de ${produtor.name}.`
  return {
    title: produtor.name,
    description,
    openGraph: {
      title: produtor.name,
      description,
      images: produtor.bannerUrl ? [produtor.bannerUrl] : [],
    },
  }
}

export default async function ProdutorSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const produtor = await getProdutor(slug)
  if (!produtor) notFound()

  const [horta, categories, allProducts, reviews, platformConfig] = await Promise.all([
    produtor.hortaId ? getHortaById(produtor.hortaId) : null,
    listCategories(produtor.id),
    listProducts(produtor.id),
    listReviews(produtor.id),
    getPlatformConfig(),
  ])

  // Strip Firestore Timestamps — not JSON-serializable for Server→Client props
  const { createdAt: _pca, updatedAt: _pua, ...sp } = produtor
  const serializableCategories = categories.map(({ createdAt: _c, updatedAt: _u, ...r }) => r)
  const serializableProducts = allProducts.map(({ createdAt: _c, updatedAt: _u, ...r }) => r)
  const serializableHorta = horta
    ? (({ createdAt: _c, updatedAt: _u, ...r }) => r)(horta)
    : null

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : null

  const feeLabel =
    produtor.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(produtor.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`

  const minOrder =
    produtor.minOrderValueInCents === 0
      ? null
      : `Pedido mínimo R$ ${(produtor.minOrderValueInCents / 100).toFixed(2).replace('.', ',')}`

  return (
    <div>
      {/* Banner de horta */}
      {horta && (
        <div className="border-b border-brand-100 bg-brand-50 px-4 py-3">
          <p className="mx-auto max-w-4xl text-sm text-brand-700">
            <svg
              className="mr-1.5 inline h-4 w-4 align-text-bottom"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
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

      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6">
        {/* Logo + nome */}
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

        {produtor.description && (
          <p className="mb-4 text-sm text-neutral-600">{produtor.description}</p>
        )}

        {/* Pills de info */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
              produtor.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-600',
            ].join(' ')}
          >
            <span
              className={['h-1.5 w-1.5 rounded-full', produtor.isOpen ? 'bg-emerald-500' : 'bg-neutral-400'].join(' ')}
              aria-hidden="true"
            />
            {produtor.isOpen ? 'Aberto agora' : 'Fechado'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {produtor.estimatedDeliveryTimeMin}–{produtor.estimatedDeliveryTimeMax} min
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1.33 9.326A2 2 0 008.32 19h7.36a2 2 0 001.99-1.674L19 8" />
            </svg>
            {feeLabel}
          </span>
          {minOrder && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              {minOrder}
            </span>
          )}
          {avgRating !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              <span className="text-amber-400">★</span>
              {avgRating.toFixed(1)} ({reviews.length})
            </span>
          )}
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

        {/* Horários — <details> nativo, sem JS */}
        <details className="mb-6 rounded-xl border border-neutral-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Horários de atendimento
            </span>
            <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
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
        </details>

        {/* Catálogo interativo (Client island) */}
        <ProdutorCatalog
          produtor={sp}
          initialCategories={serializableCategories}
          initialProducts={serializableProducts}
          horta={serializableHorta}
          demoMode={platformConfig.demoMode}
        />

        {/* Avaliações (estáticas — SSR) */}
        <div className="mb-10">
          <h2 className="mb-4 text-base font-bold text-neutral-900">Avaliações</h2>
          {reviews.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Ainda sem avaliações — seja o primeiro a avaliar!
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-900">
                      {review.authorName}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {review.createdAt.toDate().toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="mb-2 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={star <= review.rating ? 'text-amber-400' : 'text-neutral-200'}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-neutral-600">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
