'use client'

import { deleteReview, subscribeToAllReviews } from '@marketplace/shared-services'
import type { Review } from '@marketplace/shared-types'
import { useEffect, useState } from 'react'

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? 'text-amber-400' : 'text-neutral-200'}>
          ★
        </span>
      ))}
    </span>
  )
}

function fmtDate(ts: Review['createdAt']): string {
  try {
    return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

export default function AvaliacoesPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [tab, setTab] = useState<'ativas' | 'removidas'>('ativas')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const unsub = subscribeToAllReviews(setReviews)
    return unsub
  }, [])

  const ativas = reviews.filter((r) => !r.deleted)
  const removidas = reviews.filter((r) => r.deleted)
  const displayed = tab === 'ativas' ? ativas : removidas

  async function handleRemove(reviewId: string) {
    setRemoving(true)
    try {
      await deleteReview(reviewId)
    } finally {
      setRemoving(false)
      setConfirmId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Avaliações</h1>
        <p className="mt-1 text-sm text-neutral-500">Modere as avaliações enviadas pelos consumidores.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        {(['ativas', 'removidas'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              'pb-3 text-sm font-medium capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-brand-500 text-brand-600'
                : 'text-neutral-500 hover:text-neutral-700',
            ].join(' ')}
          >
            {t === 'ativas' ? `Ativas (${ativas.length})` : `Removidas (${removidas.length})`}
          </button>
        ))}
      </div>

      {/* Modal de confirmação */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-neutral-900">Remover avaliação?</h2>
            <p className="mb-5 text-sm text-neutral-500">
              A avaliação será marcada como removida e deixará de aparecer para os consumidores.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="flex-1 rounded-xl border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleRemove(confirmId)}
                disabled={removing}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {removing ? 'Removendo…' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {displayed.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {tab === 'ativas' ? 'Nenhuma avaliação ativa.' : 'Nenhuma avaliação removida.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{review.authorName}</p>
                  <p className="text-xs text-neutral-400">{review.produtorName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400">{fmtDate(review.createdAt)}</span>
                  <StarDisplay rating={review.rating} />
                  {!review.deleted && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(review.id)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-neutral-600">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
