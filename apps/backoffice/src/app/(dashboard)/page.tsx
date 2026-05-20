'use client'

import { subscribeToAllOrders, subscribeToAllProdutores } from '@marketplace/shared-services'
import type { Order, OrderStatus, Produtor } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

// ─── helpers ───────────────────────────────────────────────────────────────

const COMPLETED: OrderStatus[] = ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered']
const ACTIVE: OrderStatus[] = ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'on_delivery']

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
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

function startOf(daysAgo: number): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function todayStart(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function orderSeconds(o: Order): number {
  return (o.createdAt as unknown as { seconds: number })?.seconds ?? 0
}

function fmtDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch { return '—' }
}

// ─── sub-components ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  sub,
  accent,
  href,
}: {
  label: string
  value: string
  icon: string
  sub?: string
  accent?: boolean
  href?: string
}) {
  const cls = [
    'rounded-xl border p-5 shadow-sm',
    accent ? 'border-amber-200 bg-amber-50' : 'border-neutral-200 bg-white',
  ].join(' ')

  const inner = (
    <>
      <div className="mb-1 text-2xl">{icon}</div>
      <p className={['text-2xl font-bold', accent ? 'text-amber-700' : 'text-neutral-900'].join(' ')}>
        {value}
      </p>
      <p className={['mt-0.5 text-xs', accent ? 'text-amber-600' : 'text-neutral-500'].join(' ')}>
        {label}
      </p>
      {sub && <p className="mt-1 text-xs font-semibold text-brand-600">{sub}</p>}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={`${cls} transition-shadow hover:shadow-md block`}>
        {inner}
      </Link>
    )
  }
  return <div className={cls}>{inner}</div>
}

// ─── page ──────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ordersReady = false
    let produtoresReady = false

    const unsubOrders = subscribeToAllOrders((list) => {
      setOrders(list)
      ordersReady = true
      if (produtoresReady) setLoading(false)
    })

    const unsubProd = subscribeToAllProdutores((list) => {
      setProdutores(list)
      produtoresReady = true
      if (ordersReady) setLoading(false)
    })

    return () => { unsubOrders(); unsubProd() }
  }, [])

  // ── computed ──────────────────────────────────────────────────────────────

  const today = todayStart()
  const ago30 = startOf(30)

  const todayOrders = useMemo(
    () => orders.filter((o) => orderSeconds(o) >= today),
    [orders, today],
  )
  const ago30Orders = useMemo(
    () => orders.filter((o) => orderSeconds(o) >= ago30),
    [orders, ago30],
  )

  const todayCompleted = useMemo(() => todayOrders.filter((o) => COMPLETED.includes(o.status)), [todayOrders])
  const ago30Completed = useMemo(() => ago30Orders.filter((o) => COMPLETED.includes(o.status)), [ago30Orders])

  const gmvHoje = todayCompleted.reduce((s, o) => s + o.totalInCents, 0)
  const gmv30 = ago30Completed.reduce((s, o) => s + o.totalInCents, 0)
  const ticket30 = ago30Completed.length > 0 ? Math.round(gmv30 / ago30Completed.length) : 0
  const activeNow = orders.filter((o) => ACTIVE.includes(o.status)).length

  const pendingProdutores = produtores.filter((p) => p.status === 'pending').length
  const approvedProdutores = produtores.filter((p) => p.status === 'approved').length

  // Taxa de conclusão 30d (pedidos completos / total excluindo pending)
  const finalized30 = ago30Orders.filter((o) =>
    [...COMPLETED, 'cancelled', 'refunded'].includes(o.status),
  )
  const conclusionRate = finalized30.length > 0
    ? Math.round((ago30Completed.length / finalized30.length) * 100)
    : 0

  // Top 5 produtores por GMV (30d)
  const topProdutores = useMemo(() => {
    const map: Record<string, { name: string; gmv: number; count: number }> = {}
    ago30Completed.forEach((o) => {
      if (!map[o.produtorId]) {
        map[o.produtorId] = { name: o.produtorName ?? o.produtorId, gmv: 0, count: 0 }
      }
      map[o.produtorId]!.gmv += o.totalInCents
      map[o.produtorId]!.count += 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1].gmv - a[1].gmv)
      .slice(0, 5)
  }, [ago30Completed])

  // Últimos 10 pedidos
  const recentOrders = orders.slice(0, 10)

  // ── render ────────────────────────────────────────────────────────────────

  const dash = loading ? '—' : undefined

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Visão geral</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs — Hoje */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Hoje</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon="📦"
            label="Pedidos hoje"
            value={dash ?? String(todayOrders.length)}
            sub={activeNow > 0 ? `${activeNow} ativo${activeNow !== 1 ? 's' : ''}` : undefined}
            href="/pedidos"
          />
          <KpiCard
            icon="💰"
            label="GMV hoje"
            value={dash ?? formatCurrency(gmvHoje)}
          />
          <KpiCard
            icon="✅"
            label="Concluídos hoje"
            value={dash ?? String(todayCompleted.length)}
          />
          <KpiCard
            icon="⏳"
            label="Produtores pendentes"
            value={dash ?? String(pendingProdutores)}
            accent={!loading && pendingProdutores > 0}
            href="/produtores?tab=pending"
          />
        </div>
      </div>

      {/* KPIs — 30 dias */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Últimos 30 dias</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            icon="🛒"
            label="Total de pedidos"
            value={dash ?? String(ago30Orders.length)}
            href="/pedidos"
          />
          <KpiCard
            icon="📈"
            label="GMV"
            value={dash ?? formatCurrency(gmv30)}
          />
          <KpiCard
            icon="🧾"
            label="Ticket médio"
            value={dash ?? (ticket30 ? formatCurrency(ticket30) : '—')}
          />
          <KpiCard
            icon="🌿"
            label="Produtores aprovados"
            value={dash ?? String(approvedProdutores)}
            href="/produtores"
            sub={conclusionRate > 0 ? `${conclusionRate}% taxa de conclusão` : undefined}
          />
        </div>
      </div>

      {/* Alerta de pendentes */}
      {!loading && pendingProdutores > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div>
            <p className="font-semibold text-amber-800">
              {pendingProdutores} produtor{pendingProdutores > 1 ? 'es' : ''} aguardando aprovação
            </p>
            <p className="mt-0.5 text-sm text-amber-600">
              Revise os cadastros e aprove ou rejeite cada um.
            </p>
          </div>
          <Link
            href="/produtores?tab=pending"
            className="flex-shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Revisar →
          </Link>
        </div>
      )}

      {/* Tabelas */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Top produtores */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-bold text-neutral-700">Top produtores — GMV 30 dias</h2>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : topProdutores.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">Sem dados no período.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {topProdutores.map(([id, data], i) => (
                <li key={id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-5 text-center font-bold text-neutral-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-neutral-900">{data.name}</p>
                    <p className="text-xs text-neutral-400">{data.count} pedido{data.count !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="font-bold text-neutral-900">{formatCurrency(data.gmv)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Últimos pedidos */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
            <h2 className="text-sm font-bold text-neutral-700">Últimos pedidos</h2>
            <Link href="/pedidos" className="text-xs text-brand-500 hover:underline">Ver todos →</Link>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
            </div>
          ) : recentOrders.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">Sem pedidos ainda.</p>
          ) : (
            <ul className="divide-y divide-neutral-50">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-bold text-neutral-700">
                      #{o.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-neutral-400">
                      {o.produtorName ?? '—'} · {fmtDate(o.createdAt)}
                    </p>
                  </div>
                  <span className="font-semibold text-neutral-900">{formatCurrency(o.totalInCents)}</span>
                  <span className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    STATUS_COLOR[o.status] ?? 'bg-neutral-100 text-neutral-600',
                  ].join(' ')}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
