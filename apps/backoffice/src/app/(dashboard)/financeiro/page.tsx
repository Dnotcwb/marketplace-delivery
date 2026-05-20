'use client'

import { subscribeToAllOrders } from '@marketplace/shared-services'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'

const COMPLETED: OrderStatus[] = ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered']

function startOf(daysAgo: number): number {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / 1000)
}

function orderSeconds(o: Order): number {
  return (o.createdAt as unknown as { seconds: number })?.seconds ?? 0
}

type Period = '7' | '30' | '90'

export default function FinanceiroPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30')

  useEffect(() => {
    return subscribeToAllOrders((list) => {
      setOrders(list)
      setLoading(false)
    })
  }, [])

  const cutoff = startOf(Number(period))

  const filtered = useMemo(
    () => orders.filter((o) => orderSeconds(o) >= cutoff && COMPLETED.includes(o.status)),
    [orders, cutoff],
  )

  // Agrupar por produtor
  const byProdutor = useMemo(() => {
    const map: Record<string, { name: string; gmv: number; comissao: number; count: number }> = {}
    filtered.forEach((o) => {
      if (!map[o.produtorId]) {
        map[o.produtorId] = { name: o.produtorName ?? o.produtorId, gmv: 0, comissao: 0, count: 0 }
      }
      map[o.produtorId]!.gmv += o.totalInCents
      map[o.produtorId]!.comissao += 0  // comissão será calculada quando tivermos o campo
      map[o.produtorId]!.count += 1
    })
    return Object.entries(map).sort((a, b) => b[1].gmv - a[1].gmv)
  }, [filtered])

  const totalGmv = filtered.reduce((s, o) => s + o.totalInCents, 0)

  function fmtDate(ts: unknown): string {
    if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
    try {
      return (ts as Timestamp).toDate().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    } catch { return '—' }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Financeiro</h1>
          <p className="mt-0.5 text-sm text-neutral-500">Faturamento por produtor no período.</p>
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

      {/* KPI total */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-1 text-2xl">💰</div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? '—' : formatCurrency(totalGmv)}</p>
          <p className="mt-0.5 text-xs text-neutral-500">GMV total no período</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-1 text-2xl">📦</div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? '—' : filtered.length}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Pedidos concluídos</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="mb-1 text-2xl">🌿</div>
          <p className="text-2xl font-bold text-neutral-900">{loading ? '—' : byProdutor.length}</p>
          <p className="mt-0.5 text-xs text-neutral-500">Produtores com vendas</p>
        </div>
      </div>

      {/* Tabela por produtor */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
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
                    <td className="px-5 py-3 text-xs text-neutral-400 font-bold">{i + 1}</td>
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
