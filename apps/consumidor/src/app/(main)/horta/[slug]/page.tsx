import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import {
  getHortaBySlug,
  getProdutorById,
  listCategories,
  listHortasAtivas,
  listProducts,
} from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import HortaCatalog from '@/components/HortaCatalog'

export const revalidate = 300
export const dynamicParams = true

const getHorta = cache(async (slug: string) => getHortaBySlug(slug))

export async function generateStaticParams() {
  try {
    const hortas = await listHortasAtivas()
    return hortas.map((h) => ({ slug: h.slug }))
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
  const horta = await getHorta(slug)
  if (!horta) return {}
  const description =
    horta.description || `Compre de vários produtores da Horta ${horta.name} em um só pedido.`
  return {
    title: `Horta ${horta.name}`,
    description,
    openGraph: {
      title: `Horta ${horta.name}`,
      description,
      images: horta.bannerUrl ? [horta.bannerUrl] : [],
    },
  }
}

export default async function HortaSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const horta = await getHorta(slug)
  if (!horta) notFound()

  // Busca produtores em paralelo
  const produtoresRaw = horta.produtorIds.length
    ? await Promise.all(horta.produtorIds.map((id) => getProdutorById(id))).then((results) =>
        results.filter((p): p is Produtor => p !== null),
      )
    : []

  // Catálogo inicial do primeiro produtor
  const firstId = produtoresRaw[0]?.id
  const [initialCategories, initialProducts] = firstId
    ? await Promise.all([listCategories(firstId), listProducts(firstId)])
    : [[], []]

  // Strip Timestamps para serialização Server→Client
  const { createdAt: _hca, updatedAt: _hua, ...sh } = horta
  const serializableProdutores = produtoresRaw.map(
    ({ createdAt: _c, updatedAt: _u, approvedAt: _a, rejectedAt: _r, ...r }) => r,
  )
  const serializableCategories = initialCategories.map(
    ({ createdAt: _c, updatedAt: _u, ...r }) => r,
  )
  const serializableProducts = initialProducts.map(
    ({ createdAt: _c, updatedAt: _u, ...r }) => r,
  )

  const feeLabel =
    horta.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`

  return (
    <div>
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

        {horta.description && (
          <p className="mb-4 text-sm text-neutral-600">{horta.description}</p>
        )}

        {/* Pills de info */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {horta.estimatedDeliveryTimeMin}–{horta.estimatedDeliveryTimeMax} min
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1.33 9.326A2 2 0 008.32 19h7.36a2 2 0 001.99-1.674L19 8" />
            </svg>
            {feeLabel}
          </span>
          {horta.minOrderValueInCents > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
              Mínimo R$ {(horta.minOrderValueInCents / 100).toFixed(2).replace('.', ',')}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600">
            {produtoresRaw.length} produtor{produtoresRaw.length !== 1 ? 'es' : ''}
          </span>
        </div>

        {/* Catálogo interativo (Client island) */}
        <HortaCatalog
          horta={sh}
          initialProdutores={serializableProdutores}
          initialCategories={serializableCategories}
          initialProducts={serializableProducts}
        />
      </div>
    </div>
  )
}
