'use client'

import { firestore } from '@marketplace/shared-firebase'
import { subscribeToAllOrders } from '@marketplace/shared-services'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { doc, updateDoc, arrayUnion, serverTimestamp, Timestamp } from 'firebase/firestore'
import { useState, useEffect } from 'react'

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending:     'bg-yellow-100 text-yellow-800',
  confirmed:   'bg-blue-100 text-blue-800',
  accepted:    'bg-indigo-100 text-indigo-800',
  preparing:   'bg-purple-100 text-purple-800',
  ready:       'bg-cyan-100 text-cyan-800',
  on_delivery: 'bg-orange-100 text-orange-800',
  delivered:   'bg-emerald-100 text-emerald-800',
  cancelled:   'bg-red-100 text-red-800',
  refunded:    'bg-neutral-100 text-neutral-600',
}

const STATUS_SEQUENCE: OrderStatus[] = [
  'confirmed',
  'accepted',
  'preparing',
  'ready',
  'on_delivery',
  'delivered',
]

const STATUS_FILTER_OPTIONS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Aguardando pagamento' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'accepted', label: 'Aceitos' },
  { value: 'preparing', label: 'Em preparo' },
  { value: 'ready', label: 'Prontos' },
  { value: 'on_delivery', label: 'Em entrega' },
  { value: 'delivered', label: 'Entregues' },
  { value: 'cancelled', label: 'Cancelados' },
]

function formatDate(ts: unknown): string {
  if (!ts) return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

async function advanceStatus(order: Order) {
  const idx = STATUS_SEQUENCE.indexOf(order.status as OrderStatus)
  // 'pending' não está na sequência mas pode ser avançado manualmente para 'confirmed'
  // (útil em dev/teste sem webhook de pagamento)
  if (idx < 0 && order.status !== 'pending') return
  const nextStatus: OrderStatus = idx < 0 ? 'confirmed' : (STATUS_SEQUENCE[idx + 1] as OrderStatus)
  if (!nextStatus) return

  const tsNow = Timestamp.now()
  const ref = doc(firestore, 'orders', order.id)
  const timestampField = `${nextStatus}At`

  await updateDoc(ref, {
    status: nextStatus,
    statusHistory: arrayUnion({ status: nextStatus, timestamp: tsNow }),
    [timestampField]: serverTimestamp(),
  })
}

async function cancelOrder(order: Order) {
  if (!confirm(`Cancelar o pedido #${order.id.slice(0, 8)}?`)) return
  const tsNow = Timestamp.now()
  const ref = doc(firestore, 'orders', order.id)
  await updateDoc(ref, {
    status: 'cancelled',
    statusHistory: arrayUnion({ status: 'cancelled', timestamp: tsNow }),
    cancelledAt: serverTimestamp(),
  })
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToAllOrders(
      (list) => {
        setOrders(list)
        setLoading(false)
        setSubscriptionError(null)
      },
      (err) => {
        const code = (err as { code?: string }).code ?? ''
        const msg = code === 'permission-denied'
          ? 'Sem permissão para listar pedidos. Verifique se seu token está atualizado e recarregue.'
          : `Erro na subscription de pedidos (${code || err.message}). Recarregue a página.`
        setSubscriptionError(msg)
        setLoading(false)
      },
    )
    return unsub
  }, [])

  const filtered = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.produtorName.toLowerCase().includes(q)
      )
    }
    return true
  })

  const canAdvance = (o: Order) =>
    !['delivered', 'cancelled', 'refunded'].includes(o.status)

  const canCancel = (o: Order) =>
    !['delivered', 'cancelled', 'refunded'].includes(o.status)

  const nextStatusLabel = (o: Order): string => {
    const idx = STATUS_SEQUENCE.indexOf(o.status as OrderStatus)
    const next: OrderStatus | undefined = idx < 0
      ? (o.status === 'pending' ? 'confirmed' : undefined)
      : (STATUS_SEQUENCE[idx + 1] as OrderStatus | undefined)
    return next ? ORDER_STATUS_LABELS[next] : ''
  }

  return (
    <div className="p-6">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pedidos</h1>
          <p className="text-sm text-neutral-500">
            {orders.length} pedido{orders.length !== 1 ? 's' : ''} no total
          </p>
        </div>
      </div>

      {/* Erro de subscription */}
      {subscriptionError && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <span className="flex-1">{subscriptionError}</span>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">
            Recarregar
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-5 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID, cliente ou horta…"
          className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-72"
        />

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={[
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                filter === opt.value
                  ? 'bg-brand-500 text-white'
                  : 'border border-neutral-300 bg-white text-neutral-600 hover:border-brand-400',
              ].join(' ')}
            >
              {opt.label}
              {opt.value !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({orders.filter((o) => o.status === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-sm text-neutral-400">Nenhum pedido encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Horta</th>
                <th className="px-4 py-3 text-left">Criado em</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((order) => (
                <tr key={order.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{order.customerName || '—'}</p>
                    <p className="text-xs text-neutral-400">{order.deliveryAddress.city}/{order.deliveryAddress.state}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{order.produtorName}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-neutral-900">
                    {formatCurrency(order.totalInCents)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[order.status]}`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      {canAdvance(order) && nextStatusLabel(order) && (
                        <button
                          type="button"
                          onClick={() => advanceStatus(order)}
                          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
                          title={`Avançar para: ${nextStatusLabel(order)}`}
                        >
                          → {nextStatusLabel(order)}
                        </button>
                      )}
                      {canCancel(order) && (
                        <button
                          type="button"
                          onClick={() => cancelOrder(order)}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
