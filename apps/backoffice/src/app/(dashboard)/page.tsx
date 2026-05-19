'use client'

import { subscribeToAllProdutores } from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function AdminDashboardPage() {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return subscribeToAllProdutores((list) => {
      setProdutores(list)
      setLoading(false)
    })
  }, [])

  const pending = produtores.filter((p) => p.status === 'pending').length
  const approved = produtores.filter((p) => p.status === 'approved').length
  const suspended = produtores.filter((p) => p.status === 'suspended').length
  const total = produtores.length

  const stats = [
    { label: 'Produtores pendentes', value: pending, href: '/produtores?tab=pending', accent: pending > 0, icon: '⏳' },
    { label: 'Produtores aprovados', value: approved, href: '/produtores?tab=approved', accent: false, icon: '✅' },
    { label: 'Suspensos', value: suspended, href: '/produtores?tab=suspended', accent: suspended > 0, icon: '🚫' },
    { label: 'Total de produtores', value: total, href: '/produtores', accent: false, icon: '🌿' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Visão geral</h1>
        <p className="mt-1 text-sm text-neutral-500">Resumo da plataforma em tempo real.</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={[
              'rounded-xl border p-5 shadow-sm transition-shadow hover:shadow-md',
              s.accent
                ? 'border-amber-200 bg-amber-50'
                : 'border-neutral-200 bg-white',
            ].join(' ')}
          >
            <div className="mb-1 text-2xl">{s.icon}</div>
            <p className={['text-3xl font-bold', s.accent ? 'text-amber-700' : 'text-neutral-900'].join(' ')}>
              {loading ? '—' : s.value}
            </p>
            <p className={['mt-0.5 text-xs', s.accent ? 'text-amber-600' : 'text-neutral-500'].join(' ')}>
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Ação rápida para pendentes */}
      {!loading && pending > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="font-semibold text-amber-800">
              {pending} produtor{pending > 1 ? 'es' : ''} aguardando aprovação
            </p>
            <p className="mt-0.5 text-sm text-amber-600">
              Revise os cadastros e aprove ou rejeite cada um.
            </p>
          </div>
          <Link
            href="/produtores?tab=pending"
            className="flex-shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Revisar →
          </Link>
        </div>
      )}

      {/* Atalhos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Ações rápidas</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/produtores" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Gerenciar produtores
          </Link>
          <Link href="/pedidos" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Ver pedidos
          </Link>
          <Link href="/cupons" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Gerenciar cupons
          </Link>
        </div>
      </div>
    </div>
  )
}
