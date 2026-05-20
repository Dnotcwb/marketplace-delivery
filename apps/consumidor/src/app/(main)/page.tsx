'use client'

import { listProdutoresAprovados } from '@marketplace/shared-services'
import type { Produtor, ProdutorCertification } from '@marketplace/shared-types'
import { useEffect, useState } from 'react'
import ProdutorCard from '@/components/ProdutorCard'

const CERT_FILTERS: { value: ProdutorCertification | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'organico', label: 'Orgânico' },
  { value: 'agroecologico', label: 'Agroecológico' },
  { value: 'natural', label: 'Natural' },
  { value: 'biodynamico', label: 'Biodinâmico' },
  { value: 'sem_agrotoxicos', label: 'Sem agrotóxicos' },
]

export default function HomePage() {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)
  const [activeCert, setActiveCert] = useState<ProdutorCertification | 'all'>('all')

  useEffect(() => {
    listProdutoresAprovados()
      .then(setProdutores)
      .catch(() => setErro(true))
      .finally(() => setLoading(false))
  }, [])

  const filtered =
    activeCert === 'all'
      ? produtores
      : produtores.filter((p) => p.certifications.includes(activeCert))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Hero */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">
          Hortas e produtores perto de você
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Produtos frescos, direto do campo para a sua mesa.
        </p>
      </div>

      {/* Filtros por certificação */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {CERT_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setActiveCert(f.value)}
            className={[
              'flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              activeCert === f.value
                ? 'bg-brand-500 text-white'
                : 'border border-neutral-300 bg-white text-neutral-600 hover:border-brand-400',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid de produtores */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl bg-neutral-200"
            />
          ))}
        </div>
      ) : erro ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">⚠️</span>
          <p className="text-lg font-semibold text-neutral-700">
            Não foi possível carregar os produtores.
          </p>
          <p className="text-sm text-neutral-500">
            Verifique sua conexão ou tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-brand-600 hover:underline"
          >
            Recarregar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">🌱</span>
          <p className="text-lg font-semibold text-neutral-700">
            {activeCert === 'all'
              ? 'Nenhum produtor cadastrado ainda.'
              : 'Nenhum produtor com essa certificação.'}
          </p>
          {activeCert !== 'all' && (
            <button
              onClick={() => setActiveCert('all')}
              className="text-sm text-brand-600 hover:underline"
            >
              Ver todos os produtores
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <ProdutorCard key={p.id} produtor={p} />
          ))}
        </div>
      )}
    </div>
  )
}
