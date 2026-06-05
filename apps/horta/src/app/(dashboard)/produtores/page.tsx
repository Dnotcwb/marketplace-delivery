'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Produtor } from '@marketplace/shared-types'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useHorta } from '@/components/HortaGuard'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  suspended: 'Suspenso',
  rejected: 'Rejeitado',
}

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-neutral-100 text-neutral-500',
}

export default function ProdutoresPage() {
  const { horta } = useHorta()
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!horta.id) return
    setLoading(true)
    getDocs(
      query(collection(firestore, 'produtores'), where('hortaId', '==', horta.id)),
    )
      .then((snap) => {
        setProdutores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor))
      })
      .finally(() => setLoading(false))
  }, [horta.id, horta.produtorIds.length])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Produtores</h1>
        <p className="text-sm text-neutral-500">
          Produtores vinculados à {horta.name}.
        </p>
      </div>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : produtores.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-300 text-center">
          <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-neutral-500">Nenhum produtor vinculado</p>
            <p className="text-xs text-neutral-400">O administrador precisa vincular produtores à sua horta.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {produtores.map((p) => (
            <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      className="h-10 w-10 rounded-full object-cover shrink-0 border border-neutral-200"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg">
                      🌿
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {p.address?.neighborhood && `${p.address.neighborhood}, `}
                      {p.address?.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={[
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    STATUS_CLS[p.status] ?? 'bg-neutral-100 text-neutral-500',
                  ].join(' ')}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </div>
              </div>

              {/* Contato */}
              {(p.email || p.phone) && (
                <div className="mt-3 flex flex-wrap gap-4 border-t border-neutral-100 pt-3">
                  {p.email && (
                    <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {p.email}
                    </a>
                  )}
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-600">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {p.phone}
                    </a>
                  )}
                </div>
              )}

              {/* Certificações */}
              {p.certifications && p.certifications.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.certifications.map((c) => (
                    <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">
                      {c.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
