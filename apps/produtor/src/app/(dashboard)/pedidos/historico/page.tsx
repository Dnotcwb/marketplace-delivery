'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'refunded']

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled:  'bg-red-100 text-red-700',
  refunded:   'bg-red-100 text-red-700',
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

export default function HistoricoPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')

  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const q = query(
      collection(firestore, 'orders'),
      where('produtorId', '==', produtor.id),
      orderBy('createdAt', 'desc'),
      limit(200),
    )

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Order)
        .filter((o) => TERMINAL.includes(o.status))
      setOrders(list)
      setLoading(false)
    }, (err) => {
      console.error('historico error:', err)
      setLoading(false)
    })

    return unsub
  }, [prodLoading, produtor])

  const filtered = useMemo(() => {
    let list = orders
    if (statusFilter !== 'all') list = list.filter((o) => o.status === statusFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customerName?.toLowerCase().includes(q) ||
          o.items.some((i) => i.productName.toLowerCase().includes(q)),
      )
    }
    return list
  }, [orders, statusFilter, search])

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
          {orders.length}
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
          onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="all">Todos os status</option>
          {TERMINAL.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
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
          {filtered.map((order) => (
            <div key={order.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold text-neutral-800">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className={[
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-600',
                    ].join(' ')}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-neutral-700 truncate">
                    {order.customerName || 'Cliente'}
                  </p>
                  <p className="text-xs text-neutral-400">{fullDate(order.createdAt)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-neutral-900">{formatCurrency(order.totalInCents)}</p>
                  <p className="text-xs text-neutral-400">{order.items.length} iten{order.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
