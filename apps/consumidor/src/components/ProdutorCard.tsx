import type { Produtor, ProdutorCertification } from '@marketplace/shared-types'
import Image from 'next/image'
import Link from 'next/link'

const CERT_LABELS: Record<ProdutorCertification, string> = {
  organico: 'Orgânico',
  agroecologico: 'Agroecológico',
  natural: 'Natural',
  biodynamico: 'Biodinâmico',
  sem_agrotoxicos: 'Sem agrotóxicos',
}

interface Props {
  produtor: Produtor
}

export default function ProdutorCard({ produtor }: Props) {
  const feeLabel =
    produtor.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(produtor.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`

  const timeLabel = `${produtor.estimatedDeliveryTimeMin}–${produtor.estimatedDeliveryTimeMax} min`

  return (
    <Link
      href={`/produtor/${produtor.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Banner */}
      <div className="relative h-32 w-full overflow-hidden bg-neutral-100">
        {produtor.bannerUrl ? (
          <Image
            src={produtor.bannerUrl}
            alt={`Banner de ${produtor.name}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
            <span className="text-4xl">🌿</span>
          </div>
        )}

        {/* Badge aberto/fechado */}
        <span
          className={[
            'absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold',
            produtor.isOpen
              ? 'bg-emerald-500 text-white'
              : 'bg-neutral-700/70 text-neutral-200',
          ].join(' ')}
        >
          {produtor.isOpen ? 'Aberto' : 'Fechado'}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm">
            {produtor.logoUrl ? (
              <Image
                src={produtor.logoUrl}
                alt={`Logo de ${produtor.name}`}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
                {produtor.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center gap-1.5">
              <p className="truncate font-bold text-neutral-900">{produtor.name}</p>
              {produtor.ratingCount && produtor.ratingCount > 0 && produtor.ratingAvg ? (
                <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-amber-600">
                  <span className="text-amber-400">★</span>
                  {produtor.ratingAvg.toFixed(1)}
                  <span className="font-normal text-neutral-400">({produtor.ratingCount})</span>
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs text-neutral-500">
              {produtor.address.neighborhood}, {produtor.address.city}
            </p>
          </div>
        </div>

        {/* Entrega */}
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {timeLabel}
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1.33 9.326A2 2 0 008.32 19h7.36a2 2 0 001.99-1.674L19 8" />
            </svg>
            {feeLabel}
          </span>
        </div>

        {/* Certificações */}
        {produtor.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {produtor.certifications.slice(0, 3).map((cert) => (
              <span
                key={cert}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
              >
                {CERT_LABELS[cert]}
              </span>
            ))}
            {produtor.certifications.length > 3 && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                +{produtor.certifications.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
