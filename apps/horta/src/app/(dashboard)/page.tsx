'use client'

import Link from 'next/link'
import { useHorta } from '@/components/HortaGuard'

export default function DashboardPage() {
  const { horta } = useHorta()

  const stats = [
    {
      label: 'Produtores vinculados',
      value: horta.produtorIds.length,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'bg-brand-50 text-brand-600',
    },
    {
      label: 'Taxa de entrega base',
      value: `R$ ${(horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ',')}`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
        </svg>
      ),
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Pedido mínimo',
      value: `R$ ${(horta.minOrderValueInCents / 100).toFixed(2).replace('.', ',')}`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Tempo estimado de entrega',
      value: `${horta.estimatedDeliveryTimeMin}–${horta.estimatedDeliveryTimeMax} min`,
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-purple-50 text-purple-600',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">{horta.name}</h1>
          <span className={[
            'rounded-full px-2.5 py-1 text-xs font-semibold',
            horta.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-neutral-100 text-neutral-500',
          ].join(' ')}>
            {horta.status === 'active' ? 'Ativa' : 'Inativa'}
          </span>
        </div>
        {horta.description && (
          <p className="mt-1 text-sm text-neutral-500">{horta.description}</p>
        )}
        <p className="mt-0.5 text-sm text-neutral-400">
          {horta.address.street && `${horta.address.street}${horta.address.number ? `, ${horta.address.number}` : ''} — `}
          {horta.address.neighborhood && `${horta.address.neighborhood}, `}
          {horta.address.city}{horta.address.state && ` / ${horta.address.state}`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 inline-flex rounded-lg p-2 ${s.color}`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ações rápidas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/minha-horta"
          className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 group-hover:bg-brand-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-neutral-900">Editar dados da horta</p>
            <p className="text-sm text-neutral-500">Atualize nome, endereço e configurações de entrega.</p>
          </div>
        </Link>

        <Link
          href="/produtores"
          className="group flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-neutral-900">Ver produtores</p>
            <p className="text-sm text-neutral-500">{horta.produtorIds.length} produtor(es) vinculado(s) a esta horta.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
