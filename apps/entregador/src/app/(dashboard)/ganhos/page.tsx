'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { Order } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { subscribeToDriverOrders } from '@/lib/orderSubscriptions'

type Period = '7' | '30' | '90'

function startOfDaysAgo(days: number): number {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function orderSeconds(o: Order): number {
  return (o.createdAt as unknown as { seconds: number })?.seconds ?? 0
}

export default function GanhosPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30')
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null)

  useEffect(() => {
    if (!user) return
    return subscribeToDriverOrders(user.uid, (list) => {
      setOrders(list)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    return onSnapshot(doc(firestore, 'deliveryDrivers', user.uid), (snap) => {
      const d = snap.data()
      const count = (d?.['ratingCount'] as number | undefined) ?? 0
      const avg = d?.['ratingAvg'] as number | undefined
      setRating(count > 0 && typeof avg === 'number' ? { avg, count } : null)
    })
  }, [user])

  const delivered = orders.filter((o) => o.status === 'delivered')

  const cutoff = startOfDaysAgo(Number(period))

  const filtered = useMemo(
    () => delivered.filter((o) => orderSeconds(o) >= cutoff),
    [delivered, cutoff],
  )

  const totalEarned = filtered.reduce((s, o) => s + o.deliveryFeeInCents, 0)
  const totalAllTime = delivered.reduce((s, o) => s + o.deliveryFeeInCents, 0)

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-900">Meus ganhos</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {/* Nota do entregador */}
      {rating && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">⭐</div>
          <div className="flex-1">
            <p className="text-lg font-bold text-amber-900">
              {rating.avg.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-amber-600">
                / 5 · {rating.count} avaliação{rating.count !== 1 ? 'ões' : ''}
              </span>
            </p>
            <p className="text-xs text-amber-700">Sua nota média com os clientes</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-neutral-900">
            {loading ? '—' : formatCurrency(totalEarned)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">No período</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-neutral-900">
            {loading ? '—' : filtered.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Entregas</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-neutral-900">
            {loading ? '—' : filtered.length > 0 ? formatCurrency(Math.round(totalEarned / filtered.length)) : '—'}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Ticket médio</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-2xl font-bold text-neutral-900">
            {loading ? '—' : formatCurrency(totalAllTime)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Total geral</p>
        </div>
      </div>

      {/* Detalhamento */}
      {!loading && filtered.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-neutral-100 px-4 py-3">
            <h2 className="text-sm font-bold text-neutral-700">Entregas no período</h2>
          </div>
          <ul className="divide-y divide-neutral-100">
            {filtered.map((order) => (
              <li key={order.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{order.produtorName}</p>
                  <p className="text-xs text-neutral-400">
                    {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}
                  </p>
                </div>
                <p className="font-semibold text-brand-600">{formatCurrency(order.deliveryFeeInCents)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center">
          <div className="mb-3 text-4xl">💰</div>
          <p className="font-medium text-neutral-700">Nenhuma entrega no período</p>
          <p className="mt-1 text-sm text-neutral-400">
            Complete entregas para ver seus ganhos aqui.
          </p>
        </div>
      )}
    </div>
  )
}
