'use client'

import { listProdutoresAprovados } from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import ProdutorCard from '@/components/ProdutorCard'

export default function BuscaPage() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q')?.trim() ?? ''

  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProdutoresAprovados()
      .then(setProdutores)
      .finally(() => setLoading(false))
  }, [])

  const normalizar = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const filtered = query
    ? produtores.filter((p) => {
        const q = normalizar(query)
        return (
          normalizar(p.name).includes(q) ||
          normalizar(p.description).includes(q) ||
          normalizar(p.address.city).includes(q) ||
          normalizar(p.address.neighborhood).includes(q) ||
          (p.tags ?? []).some((t) => normalizar(t).includes(q))
        )
      })
    : produtores

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Cabeçalho */}
      <div className="mb-6">
        {query ? (
          <>
            <h1 className="text-xl font-bold text-neutral-900">
              Resultados para &ldquo;{query}&rdquo;
            </h1>
            {!loading && (
              <p className="mt-0.5 text-sm text-neutral-500">
                {filtered.length === 0
                  ? 'Nenhum produtor encontrado.'
                  : `${filtered.length} produtor${filtered.length > 1 ? 'es' : ''} encontrado${filtered.length > 1 ? 's' : ''}.`}
              </p>
            )}
          </>
        ) : (
          <h1 className="text-xl font-bold text-neutral-900">Todos os produtores</h1>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <span className="text-5xl">🔍</span>
          <p className="text-lg font-semibold text-neutral-700">
            Nenhum produtor encontrado para &ldquo;{query}&rdquo;
          </p>
          <p className="text-sm text-neutral-500">
            Tente outras palavras-chave ou{' '}
            <a href="/" className="text-brand-600 hover:underline">
              veja todos os produtores
            </a>
            .
          </p>
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
