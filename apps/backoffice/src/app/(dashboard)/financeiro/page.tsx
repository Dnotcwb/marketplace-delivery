'use client'

import {
  marcarTodosRepassesPagos,
  subscribeToAllOrders,
  subscribeToAllPedidosFilhos,
} from '@marketplace/shared-services'
import type { Order, OrderStatus, PedidoFilho } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

const COMPLETED: OrderStatus[] = ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered']

type Period = '7' | '30' | '90'
type Tab = 'faturamento' | 'repassos'

function startOf(daysAgo: number): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function tsSeconds(ts: unknown): number {
  return (ts as { seconds?: number })?.seconds ?? 0
}

function fmtDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return '—' }
}

// ──────────────────────────────────────────────────────
//  Aba Faturamento
// ──────────────────────────────────────────────────────

function TabFaturamento({ orders, loading, period, setPeriod }: {
  orders: Order[]
  loading: boolean
  period: Period
  setPeriod: (p: Period) => void
}) {
  const cutoff = startOf(Number(period))

  const filtered = useMemo(
    () => orders.filter((o) => tsSeconds(o.createdAt) >= cutoff && COMPLETED.includes(o.status)),
    [orders, cutoff],
  )

  const byProdutor = useMemo(() => {
    const map: Record<string, { name: string; gmv: number; count: number }> = {}
    filtered.forEach((o) => {
      if (!map[o.produtorId]) {
        map[o.produtorId] = { name: o.produtorName ?? o.produtorId, gmv: 0, count: 0 }
      }
      map[o.produtorId]!.gmv += o.totalInCents
      map[o.produtorId]!.count += 1
    })
    return Object.entries(map).sort((a, b) => b[1].gmv - a[1].gmv)
  }, [filtered])

  const totalGmv = filtered.reduce((s, o) => s + o.totalInCents, 0)

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="mb-1 text-xl sm:text-2xl">💰</div>
          <p className="truncate text-lg font-bold text-neutral-900 sm:text-2xl">
            {loading ? '—' : formatCurrency(totalGmv)}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">GMV total no período</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm">
          <div className="mb-1 text-xl sm:text-2xl">📦</div>
          <p className="truncate text-lg font-bold text-neutral-900 sm:text-2xl">
            {loading ? '—' : filtered.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Pedidos concluídos</p>
        </div>
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm lg:col-span-1">
          <div className="mb-1 text-xl sm:text-2xl">🌿</div>
          <p className="truncate text-lg font-bold text-neutral-900 sm:text-2xl">
            {loading ? '—' : byProdutor.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Produtores com vendas</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-bold text-neutral-700">Faturamento por produtor</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : byProdutor.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">Sem vendas no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-5 py-3 text-left">Produtor</th>
                  <th className="px-5 py-3 text-center">Pedidos</th>
                  <th className="px-5 py-3 text-right">GMV</th>
                  <th className="px-5 py-3 text-right">Ticket médio</th>
                  <th className="px-5 py-3 text-right">% do total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {byProdutor.map(([id, data], i) => (
                  <tr key={id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3 text-xs font-bold text-neutral-400">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-neutral-900">{data.name}</td>
                    <td className="px-5 py-3 text-center text-neutral-700">{data.count}</td>
                    <td className="px-5 py-3 text-right font-bold text-neutral-900">{formatCurrency(data.gmv)}</td>
                    <td className="px-5 py-3 text-right text-neutral-500">
                      {formatCurrency(Math.round(data.gmv / data.count))}
                    </td>
                    <td className="px-5 py-3 text-right text-neutral-500">
                      {totalGmv > 0 ? `${Math.round((data.gmv / totalGmv) * 100)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Aba Repassos
// ──────────────────────────────────────────────────────

function TabRepassos({ filhos, loading }: { filhos: PedidoFilho[]; loading: boolean }) {
  const [period, setPeriod] = useState<Period>('30')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [marking, setMarking] = useState<string | null>(null)

  const cutoff = startOf(Number(period))

  const filtered = useMemo(
    () => filhos.filter((f) => tsSeconds(f.createdAt) >= cutoff),
    [filhos, cutoff],
  )

  const pending = filtered.filter((f) => !f.repassePago)
  const paid = filtered.filter((f) => f.repassePago)

  // Agrupa pendentes por produtor
  const byProdutor = useMemo(() => {
    const map: Record<string, { name: string; total: number; ids: string[]; filhos: PedidoFilho[] }> = {}
    pending.forEach((f) => {
      if (!map[f.produtorId]) {
        map[f.produtorId] = { name: f.produtorName, total: 0, ids: [], filhos: [] }
      }
      map[f.produtorId]!.total += f.valorRepasseInCents
      map[f.produtorId]!.ids.push(f.id)
      map[f.produtorId]!.filhos.push(f)
    })
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total)
  }, [pending])

  const totalPendente = pending.reduce((s, f) => s + f.valorRepasseInCents, 0)
  const totalPago = paid.reduce((s, f) => s + f.valorRepasseInCents, 0)

  async function handleMarcarPago(produtorId: string, ids: string[]) {
    setMarking(produtorId)
    try {
      await marcarTodosRepassesPagos(ids)
    } finally {
      setMarking(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Controle de repasses para cada produtor após entrega dos pedidos.
        </p>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-5 shadow-sm">
          <div className="mb-1 text-xl sm:text-2xl">⏳</div>
          <p className="truncate text-lg font-bold text-amber-900 sm:text-2xl">
            {loading ? '—' : formatCurrency(totalPendente)}
          </p>
          <p className="mt-0.5 text-xs text-amber-700">A repassar ({pending.length} pedido{pending.length !== 1 ? 's' : ''})</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-5 shadow-sm">
          <div className="mb-1 text-xl sm:text-2xl">✅</div>
          <p className="truncate text-lg font-bold text-emerald-900 sm:text-2xl">
            {loading ? '—' : formatCurrency(totalPago)}
          </p>
          <p className="mt-0.5 text-xs text-emerald-700">Já repassado ({paid.length} pedido{paid.length !== 1 ? 's' : ''})</p>
        </div>
        <div className="col-span-2 rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm lg:col-span-1">
          <div className="mb-1 text-xl sm:text-2xl">🌿</div>
          <p className="truncate text-lg font-bold text-neutral-900 sm:text-2xl">
            {loading ? '—' : byProdutor.length}
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">Produtores com repasse pendente</p>
        </div>
      </div>

      {/* Lista por produtor */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        </div>
      ) : byProdutor.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
          <p className="text-sm font-medium text-neutral-500">
            Nenhum repasse pendente no período.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {byProdutor.map(([produtorId, data]) => (
            <div key={produtorId} className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
              {/* Cabeçalho do produtor */}
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-semibold text-neutral-900">{data.name}</p>
                  <p className="text-sm text-neutral-500">
                    {data.ids.length} pedido{data.ids.length !== 1 ? 's' : ''} · Total a repassar:{' '}
                    <span className="font-bold text-amber-700">{formatCurrency(data.total)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExpanded((v) => v === produtorId ? null : produtorId)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {expanded === produtorId ? 'Ocultar' : 'Ver pedidos'}
                  </button>
                  <button
                    onClick={() => handleMarcarPago(produtorId, data.ids)}
                    disabled={marking === produtorId}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {marking === produtorId ? 'Marcando…' : 'Marcar como pagos'}
                  </button>
                </div>
              </div>

              {/* Detalhes expandidos */}
              {expanded === produtorId && (
                <div className="border-t border-neutral-100">
                  <table className="w-full text-xs">
                    <thead className="bg-neutral-50 text-neutral-500">
                      <tr>
                        <th className="px-5 py-2 text-left">Pedido pai</th>
                        <th className="px-5 py-2 text-left">Cliente</th>
                        <th className="px-5 py-2 text-left">Data</th>
                        <th className="px-5 py-2 text-right">Repasse</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-50">
                      {data.filhos.map((f) => (
                        <tr key={f.id} className="hover:bg-neutral-50">
                          <td className="px-5 py-2 font-mono text-neutral-600">
                            {f.pedidoPaiId.slice(0, 8)}…
                          </td>
                          <td className="px-5 py-2 text-neutral-700">{f.customerName}</td>
                          <td className="px-5 py-2 text-neutral-500">{fmtDate(f.createdAt)}</td>
                          <td className="px-5 py-2 text-right font-semibold text-neutral-900">
                            {formatCurrency(f.valorRepasseInCents)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function FinanceiroPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [filhos, setFilhos] = useState<PedidoFilho[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('faturamento')
  const [period, setPeriod] = useState<Period>('30')

  useEffect(() => {
    const unsubOrders = subscribeToAllOrders((list) => {
      setOrders(list)
      setLoading(false)
    })
    const unsubFilhos = subscribeToAllPedidosFilhos(setFilhos)
    return () => {
      unsubOrders()
      unsubFilhos()
    }
  }, [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'faturamento', label: 'Faturamento' },
    { key: 'repassos', label: 'Repassos' },
  ]

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Financeiro</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Faturamento por produtor e controle de repassos.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-200">
        <div className="flex gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={[
                'border-b-2 px-5 py-3 text-sm font-medium transition-colors',
                activeTab === t.key
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'faturamento' && (
        <TabFaturamento
          orders={orders}
          loading={loading}
          period={period}
          setPeriod={setPeriod}
        />
      )}
      {activeTab === 'repassos' && (
        <TabRepassos filhos={filhos} loading={loading} />
      )}
    </div>
  )
}
