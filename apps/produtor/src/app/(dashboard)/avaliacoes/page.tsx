'use client'

import { subscribeToReviews } from '@marketplace/shared-services'
import type { Review, ReviewRating } from '@marketplace/shared-types'
import { useEffect, useMemo, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

function Stars({ value, className = '' }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex gap-0.5 ${className}`} aria-label={`${value} de 5 estrelas`}>
      {([1, 2, 3, 4, 5] as ReviewRating[]).map((s) => (
        <span key={s} className={s <= Math.round(value) ? 'text-amber-400' : 'text-neutral-200'}>★</span>
      ))}
    </span>
  )
}

export default function AvaliacoesPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [reviews, setReviews] = useState<Review[] | null>(null)

  useEffect(() => {
    if (!produtor?.id) return
    const unsub = subscribeToReviews(produtor.id, setReviews)
    return unsub
  }, [produtor?.id])

  // Distribuição por nota (5→1) a partir das reviews carregadas
  const dist = useMemo(() => {
    const d: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
    ;(reviews ?? []).forEach((r) => { d[r.rating] = (d[r.rating] ?? 0) + 1 })
    return d
  }, [reviews])

  const avg = produtor?.ratingAvg ?? null
  const total = produtor?.ratingCount ?? 0
  const loading = prodLoading || reviews === null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Avaliações</h1>
        <p className="mt-0.5 text-sm text-neutral-500">O que seus clientes acharam dos pedidos entregues.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
          <div className="mb-2 text-4xl">⭐</div>
          <p className="text-sm font-medium text-neutral-700">Você ainda não recebeu avaliações</p>
          <p className="mt-1 text-xs text-neutral-400">Elas aparecem aqui após os clientes avaliarem pedidos entregues.</p>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <p className="text-4xl font-bold text-neutral-900">{avg?.toFixed(1) ?? '—'}</p>
              <Stars value={avg ?? 0} className="my-1 text-lg" />
              <p className="text-xs text-neutral-400">{total} avaliação{total !== 1 ? 'ões' : ''}</p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:col-span-2">
              <div className="space-y-1.5">
                {([5, 4, 3, 2, 1]).map((star) => {
                  const count = dist[star] ?? 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-3 text-neutral-500">{star}</span>
                      <span className="text-amber-400">★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 text-right text-neutral-400">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="space-y-3">
            {(reviews ?? []).map((r) => (
              <div key={r.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{r.authorName}</span>
                  <span className="text-xs text-neutral-400">
                    {r.createdAt?.toDate
                      ? r.createdAt.toDate().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
                      : ''}
                  </span>
                </div>
                <Stars value={r.rating} className="mb-1.5" />
                {r.comment && <p className="text-sm text-neutral-600">{r.comment}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
