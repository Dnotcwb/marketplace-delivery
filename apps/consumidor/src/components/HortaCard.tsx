import type { Horta, Produtor, ProdutorCertification } from '@marketplace/shared-types'
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
  horta: Horta
  produtores: Produtor[]
}

export default function HortaCard({ horta, produtores }: Props) {
  const anyOpen = produtores.some((p) => p.isOpen)
  const feeLabel =
    horta.deliveryFeeInCents === 0
      ? 'Entrega grátis'
      : `Entrega R$ ${(horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`
  const timeLabel = `${horta.estimatedDeliveryTimeMin}–${horta.estimatedDeliveryTimeMax} min`
  const certs = [...new Set(produtores.flatMap((p) => p.certifications))].slice(0, 3) as ProdutorCertification[]

  return (
    <Link
      href={`/horta/${horta.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Banner */}
      <div className="relative h-32 w-full overflow-hidden bg-neutral-100">
        {horta.bannerUrl ? (
          <Image
            src={horta.bannerUrl}
            alt={`Banner de ${horta.name}`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
            <span className="text-4xl">🌿</span>
          </div>
        )}

        <span className="absolute left-2 top-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
          Horta
        </span>
        <span
          className={[
            'absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold',
            anyOpen
              ? 'bg-emerald-500 text-white'
              : 'bg-neutral-700/70 text-neutral-200',
          ].join(' ')}
        >
          {anyOpen ? 'Aberta' : 'Fechada'}
        </span>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        {/* Logo + nome */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm">
            {horta.logoUrl ? (
              <Image
                src={horta.logoUrl}
                alt={`Logo de ${horta.name}`}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white">
                {horta.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="overflow-hidden">
            <p className="truncate font-bold text-neutral-900">{horta.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {horta.address.neighborhood}, {horta.address.city}
              {produtores.length > 0 && (
                <> · {produtores.length} produtor{produtores.length !== 1 ? 'es' : ''}</>
              )}
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

        {/* Certificações agregadas */}
        {certs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {certs.map((cert) => (
              <span
                key={cert}
                className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
              >
                {CERT_LABELS[cert]}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
