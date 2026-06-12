'use client'

import { subscribeToAllOrders } from '@marketplace/shared-services'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { useEffect, useMemo, useState } from 'react'

type Period = '7' | '30' | '90'

const COMPLETED: OrderStatus[] = ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered']
const CANCELLED: OrderStatus[] = ['cancelled', 'refunded']

const STATUS_HEX: Record<OrderStatus, string> = {
  pending: '#D97706',
  confirmed: '#2563EB',
  accepted: '#4F46E5',
  preparing: '#7C3AED',
  ready: '#0891B2',
  on_delivery: '#EA580C',
  delivered: '#16A34A',
  cancelled: '#DC2626',
  refunded: '#6B7280',
}

function orderSeconds(o: Order): number {
  return (o.createdAt as unknown as { seconds: number })?.seconds ?? 0
}

/** Compacta valores em centavos: 123456 → "R$ 1,2k" */
function compactBRL(cents: number): string {
  const reais = cents / 100
  if (reais >= 1000) return `R$ ${(reais / 1000).toFixed(reais >= 10000 ? 0 : 1).replace('.', ',')}k`
  return `R$ ${reais.toFixed(0)}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface DayBucket {
  key: string
  label: string
  gmv: number
  completed: number
  cancelled: number
}

// ── Gráfico de barras (GMV por dia) ──────────────────────────────────────────

function BarChartGMV({ data }: { data: DayBucket[] }) {
  const W = 720
  const H = 220
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 26
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const max = Math.max(1, ...data.map((d) => d.gmv))
  const slot = innerW / data.length
  const barW = Math.max(2, Math.min(slot * 0.7, 40))
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="GMV por dia">
      {/* baseline */}
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#E2E8F0" strokeWidth={1} />
      {data.map((d, i) => {
        const h = (d.gmv / max) * innerH
        const x = padL + i * slot + (slot - barW) / 2
        const y = padT + innerH - h
        return (
          <g key={d.key}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill="#27A83E">
              <title>{`${d.label}: ${formatCurrency(d.gmv)}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#94A3B8">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Barras empilhadas (pedidos: entregues vs cancelados) ─────────────────────

function StackedOrders({ data }: { data: DayBucket[] }) {
  const W = 720
  const H = 220
  const padL = 8
  const padR = 8
  const padT = 12
  const padB = 26
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const max = Math.max(1, ...data.map((d) => d.completed + d.cancelled))
  const slot = innerW / data.length
  const barW = Math.max(2, Math.min(slot * 0.7, 40))
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pedidos por dia">
      <line x1={padL} y1={padT + innerH} x2={W - padR} y2={padT + innerH} stroke="#E2E8F0" strokeWidth={1} />
      {data.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2
        const hC = (d.completed / max) * innerH
        const hX = (d.cancelled / max) * innerH
        const yC = padT + innerH - hC
        const yX = yC - hX
        return (
          <g key={d.key}>
            {hC > 0 && (
              <rect x={x} y={yC} width={barW} height={hC} rx={2} fill="#16A34A">
                <title>{`${d.label}: ${d.completed} concluído(s)`}</title>
              </rect>
            )}
            {hX > 0 && (
              <rect x={x} y={yX} width={barW} height={hX} rx={2} fill="#DC2626">
                <title>{`${d.label}: ${d.cancelled} cancelado(s)`}</title>
              </rect>
            )}
            {i % labelEvery === 0 && (
              <text x={padL + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#94A3B8">
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Página ───────────────────────────────────────────────────────────────────

function Kpi({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'neutral' }) {
  const color = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-red-700' : 'text-neutral-900'
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className={`text-xl font-bold sm:text-2xl ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-neutral-500">{label}</p>
    </div>
  )
}

export default function RelatoriosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30')

  useEffect(() => {
    return subscribeToAllOrders((list) => {
      setOrders(list)
      setLoading(false)
    })
  }, [])

  const days = Number(period)

  const buckets = useMemo<DayBucket[]>(() => {
    const arr: DayBucket[] = []
    const byKey = new Map<string, DayBucket>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const b: DayBucket = {
        key: dayKey(d),
        label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        gmv: 0,
        completed: 0,
        cancelled: 0,
      }
      arr.push(b)
      byKey.set(b.key, b)
    }
    orders.forEach((o) => {
      const secs = orderSeconds(o)
      if (!secs) return
      const d = new Date(secs * 1000)
      d.setHours(0, 0, 0, 0)
      const b = byKey.get(dayKey(d))
      if (!b) return
      if (COMPLETED.includes(o.status)) {
        b.completed += 1
        b.gmv += o.totalInCents
      } else if (CANCELLED.includes(o.status)) {
        b.cancelled += 1
      }
    })
    return arr
  }, [orders, days])

  const periodOrders = useMemo(() => {
    const cutoff = Math.floor((Date.now() - days * 86400000) / 1000)
    return orders.filter((o) => orderSeconds(o) >= cutoff)
  }, [orders, days])

  const totalGmv = buckets.reduce((s, b) => s + b.gmv, 0)
  const totalCompleted = buckets.reduce((s, b) => s + b.completed, 0)
  const totalCancelled = buckets.reduce((s, b) => s + b.cancelled, 0)
  const finalized = totalCompleted + totalCancelled
  const ticket = totalCompleted > 0 ? Math.round(totalGmv / totalCompleted) : 0
  const cancelRate = finalized > 0 ? Math.round((totalCancelled / finalized) * 100) : 0
  const conclusionRate = finalized > 0 ? Math.round((totalCompleted / finalized) * 100) : 0

  // Distribuição por status (período)
  const statusDist = useMemo(() => {
    const map = new Map<OrderStatus, number>()
    periodOrders.forEach((o) => map.set(o.status, (map.get(o.status) ?? 0) + 1))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [periodOrders])
  const statusMax = Math.max(1, ...statusDist.map(([, n]) => n))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Evolução de vendas e pedidos da plataforma.</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="GMV no período" value={formatCurrency(totalGmv)} />
            <Kpi label="Pedidos concluídos" value={String(totalCompleted)} accent="green" />
            <Kpi label="Ticket médio" value={ticket ? formatCurrency(ticket) : '—'} />
            <Kpi label="Taxa de conclusão" value={`${conclusionRate}%`} accent="green" />
            <Kpi label="Taxa de cancelamento" value={`${cancelRate}%`} accent={cancelRate > 0 ? 'red' : 'neutral'} />
          </div>

          {/* GMV por dia */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-bold text-neutral-700">GMV por dia</h2>
            {totalGmv === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-400">Sem vendas no período.</p>
            ) : (
              <BarChartGMV data={buckets} />
            )}
          </section>

          {/* Pedidos por dia */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-700">Pedidos por dia</h2>
              <div className="flex items-center gap-4 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />Concluídos</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-600" />Cancelados</span>
              </div>
            </div>
            {finalized === 0 ? (
              <p className="py-12 text-center text-sm text-neutral-400">Sem pedidos no período.</p>
            ) : (
              <StackedOrders data={buckets} />
            )}
          </section>

          {/* Distribuição por status */}
          <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-neutral-700">Distribuição por status (período)</h2>
            {statusDist.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-400">Sem pedidos no período.</p>
            ) : (
              <div className="space-y-2.5">
                {statusDist.map(([status, count]) => (
                  <div key={status} className="flex items-center gap-3 text-sm">
                    <span className="w-28 flex-shrink-0 text-xs text-neutral-600">{ORDER_STATUS_LABELS[status]}</span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-100">
                      <div
                        className="flex h-full items-center justify-end rounded pr-2 text-[10px] font-bold text-white"
                        style={{ width: `${Math.max((count / statusMax) * 100, 8)}%`, backgroundColor: STATUS_HEX[status] }}
                      >
                        {count}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
