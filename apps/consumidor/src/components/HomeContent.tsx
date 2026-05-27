'use client'

import type { Horta, Produtor, ProdutorCertification } from '@marketplace/shared-types'
import { useMemo, useState } from 'react'
import HortaCard from '@/components/HortaCard'
import ProdutorCard from '@/components/ProdutorCard'

type SerializableHorta = Omit<Horta, 'createdAt' | 'updatedAt'>
type SerializableProdutor = Omit<Produtor, 'createdAt' | 'updatedAt'>

interface Props {
  hortas: SerializableHorta[]
  produtores: SerializableProdutor[]
}

const CERT_FILTERS: { value: ProdutorCertification | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'organico', label: 'Orgânico' },
  { value: 'agroecologico', label: 'Agroecológico' },
  { value: 'natural', label: 'Natural' },
  { value: 'biodynamico', label: 'Biodinâmico' },
  { value: 'sem_agrotoxicos', label: 'Sem agrotóxicos' },
]

export default function HomeContent({ hortas, produtores }: Props) {
  const [activeCert, setActiveCert] = useState<ProdutorCertification | 'all'>('all')

  const produtoresByHorta = useMemo(() => {
    const map = new Map<string, SerializableProdutor[]>()
    for (const p of produtores) {
      if (p.hortaId) {
        const list = map.get(p.hortaId) ?? []
        list.push(p)
        map.set(p.hortaId, list)
      }
    }
    return map
  }, [produtores])

  const soloProdutores = useMemo(() => produtores.filter((p) => !p.hortaId), [produtores])

  const filteredHortas = useMemo(() => {
    if (activeCert === 'all') return hortas
    return hortas.filter((h) =>
      (produtoresByHorta.get(h.id) ?? []).some((p) => p.certifications.includes(activeCert)),
    )
  }, [hortas, activeCert, produtoresByHorta])

  const filteredSolo = useMemo(() => {
    if (activeCert === 'all') return soloProdutores
    return soloProdutores.filter((p) => p.certifications.includes(activeCert))
  }, [soloProdutores, activeCert])

  const totalResults = filteredHortas.length + filteredSolo.length

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

      {/* Filtros */}
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

      {totalResults === 0 ? (
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
        <div className="space-y-8">
          {filteredHortas.length > 0 && (
            <section>
              {(filteredSolo.length > 0 || activeCert !== 'all') && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Hortas
                </h2>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredHortas.map((h) => (
                  <HortaCard
                    key={h.id}
                    horta={h as Horta}
                    produtores={(produtoresByHorta.get(h.id) ?? []) as Produtor[]}
                  />
                ))}
              </div>
            </section>
          )}

          {filteredSolo.length > 0 && (
            <section>
              {filteredHortas.length > 0 && (
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
                  Produtores independentes
                </h2>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSolo.map((p) => (
                  <ProdutorCard key={p.id} produtor={p as Produtor} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
