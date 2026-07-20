'use client'

import type { OrderStatus } from '@marketplace/shared-types'
import { driverPayoutOf, formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
import { useDriverData } from '@/components/DriverDataProvider'

const STATUS_LABELS: Partial<Record<OrderStatus, { label: string; cls: string }>> = {
  delivered:  { label: 'Entregue',   cls: 'bg-emerald-100 text-emerald-700' },
  cancelled:  { label: 'Cancelado',  cls: 'bg-red-100 text-red-600' },
  on_delivery:{ label: 'Em rota',    cls: 'bg-brand-100 text-brand-700' },
}

function fmtDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

export default function HistoricoPage() {
  const { driverOrders: orders, ordersLoading: loading } = useDriverData()

  const completed = orders.filter((o) => o.status !== 'on_delivery')

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="mb-4 text-xl font-bold text-neutral-900">Histórico de entregas</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : completed.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center">
          <div className="mb-3 text-4xl">📭</div>
          <p className="font-medium text-neutral-700">Nenhuma entrega no histórico</p>
          <p className="mt-1 text-sm text-neutral-400">Suas entregas concluídas aparecerão aqui.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {completed.map((order) => {
            const badge = STATUS_LABELS[order.status]
            return (
              <li key={order.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-neutral-900">{order.produtorName}</p>
                    <p className="mt-0.5 text-sm text-neutral-500 truncate">
                      {order.deliveryAddress.street}, {order.deliveryAddress.number} — {order.deliveryAddress.neighborhood}
                    </p>
                    <p className="mt-1 text-xs text-neutral-400">{fmtDate(order.deliveredAt ?? order.createdAt)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-brand-600">{formatCurrency(driverPayoutOf(order))}</p>
                    {badge && (
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
