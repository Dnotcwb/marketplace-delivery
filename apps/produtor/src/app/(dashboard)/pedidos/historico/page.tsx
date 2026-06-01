'use client'

import { subscribeToPedidoFilhos } from '@marketplace/shared-services'
import type { FilhoStatus, PedidoFilho } from '@marketplace/shared-types'
import { FILHO_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

const TERMINAL: FilhoStatus[] = ['retirado', 'entregue', 'cancelado']

const STATUS_COLOR: Partial<Record<FilhoStatus, string>> = {
  entregue:  'bg-emerald-100 text-emerald-700',
  retirado:  'bg-blue-100 text-blue-700',
  cancelado: 'bg-red-100 text-red-700',
}

function fullDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

function filhoSubtotal(filho: PedidoFilho): number {
  return filho.items.reduce((s, i) => s + i.priceInCents * i.quantity, 0)
}

export default function HistoricoPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [allFilhos, setAllFilhos] = useState<PedidoFilho[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<FilhoStatus | 'all'>('all')

  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const unsub = subscribeToPedidoFilhos(produtor.id, (filhos) => {
      setAllFilhos(filhos.filter((f) => TERMINAL.includes(f.status)))
      setLoading(false)
    })

    return unsub
  }, [prodLoading, produtor])

  const filtered = useMemo(() => {
    let list = allFilhos
    if (statusFilter !== 'all') list = list.filter((f) => f.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (f) =>
          f.pedidoPaiId.toLowerCase().includes(q) ||
          f.customerName?.toLowerCase().includes(q) ||
          f.items.some((i) => i.productName.toLowerCase().includes(q)),
      )
    }
    return list
  }, [allFilhos, statusFilter, search])

  if (prodLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link href="/pedidos" className="text-sm text-neutral-500 hover:text-brand-600">← Pedidos</Link>
        <h1 className="text-2xl font-bold text-neutral-900">Histórico</h1>
        <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-600">
          {allFilhos.length}
        </span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por pedido, cliente ou produto…"
          className="flex-1 min-w-[200px] rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FilhoStatus | 'all')}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="all">Todos os status</option>
          {TERMINAL.map((s) => (
            <option key={s} value={s}>{FILHO_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-3xl mb-2">📋</p>
          <p className="font-semibold text-neutral-700">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((filho) => (
            <div key={filho.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-neutral-800">
                      #{filho.pedidoPaiId.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={[
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      STATUS_COLOR[filho.status] ?? 'bg-neutral-100 text-neutral-600',
                    ].join(' ')}>
                      {FILHO_STATUS_LABELS[filho.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-neutral-700 truncate">
                    {filho.customerName || 'Cliente'}
                  </p>
                  <p className="text-xs text-neutral-400">{fullDate(filho.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-neutral-900">{formatCurrency(filhoSubtotal(filho))}</p>
                  <p className="text-xs text-brand-600 font-medium">{formatCurrency(filho.valorRepasseInCents)} repasse</p>
                  <p className="text-xs text-neutral-400">{filho.items.length} iten{filho.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
