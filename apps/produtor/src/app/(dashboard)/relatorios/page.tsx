'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Order } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

type Period = '7' | '30' | '90'

function startOf(daysAgo: number): Timestamp {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}

function fullDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    })
  } catch { return '—' }
}

function exportCsv(orders: Order[], produtorName: string) {
  const rows = [
    ['ID', 'Data', 'Cliente', 'Itens', 'Subtotal (R$)', 'Entrega (R$)', 'Desconto (R$)', 'Total (R$)', 'Status', 'Pagamento'],
    ...orders.map((o) => [
      o.id.slice(0, 8).toUpperCase(),
      fullDate(o.createdAt),
      o.customerName ?? '',
      o.items.map((i) => `${i.quantity}x ${i.productName}`).join(' | '),
      (o.subtotalInCents / 100).toFixed(2).replace('.', ','),
      (o.deliveryFeeInCents / 100).toFixed(2).replace('.', ','),
      (o.discountInCents / 100).toFixed(2).replace('.', ','),
      (o.totalInCents / 100).toFixed(2).replace('.', ','),
      o.status,
      o.payment?.method === 'pix' ? 'PIX' : 'Cartão',
    ]),
  ]

  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pedidos-${produtorName.replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RelatoriosPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [allOrders, setAllOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('7')

  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const q = query(
      collection(firestore, 'orders'),
      where('produtorId', '==', produtor.id),
    )

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Order)
        .sort((a, b) => {
          const aT = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0
          const bT = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0
          return bT - aT
        })
      setAllOrders(list)
      setLoading(false)
    }, () => setLoading(false))

    return unsub
  }, [prodLoading, produtor])

  const filtered = useMemo(() => {
    const cutoff = startOf(Number(period))
    return allOrders.filter((o) => {
      const ts = (o.createdAt as unknown as { seconds: number })?.seconds ?? 0
      return ts >= cutoff.seconds
    })
  }, [allOrders, period])

  const completed = useMemo(() =>
    filtered.filter((o) => ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered'].includes(o.status)),
  [filtered])

  const faturamento = completed.reduce((s, o) => s + o.totalInCents, 0)
  const ticket = completed.length > 0 ? Math.round(faturamento / completed.length) : 0

  const topProdutos = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach((o) => o.items.forEach((i) => {
      map[i.productName] = (map[i.productName] ?? 0) + i.quantity
    }))
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [completed])

  if (prodLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
        <div className="flex items-center gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-700 focus:border-brand-500 focus:outline-none"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <button
            onClick={() => exportCsv(filtered, produtor?.name ?? 'horta')}
            disabled={filtered.length === 0}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-40"
          >
            ⬇ Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total de pedidos', value: String(filtered.length), icon: '📦' },
          { label: 'Pedidos concluídos', value: String(completed.length), icon: '✅' },
          { label: 'Faturamento', value: formatCurrency(faturamento), icon: '💰' },
          { label: 'Ticket médio', value: ticket ? formatCurrency(ticket) : '—', icon: '🧾' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-1 text-2xl">{kpi.icon}</div>
            <p className="text-2xl font-bold text-neutral-900">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Top produtos */}
      {topProdutos.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-neutral-700">Produtos mais vendidos no período</h2>
          <ul className="space-y-2">
            {topProdutos.map(([name, qty], i) => (
              <li key={name} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center text-xs font-bold text-neutral-400">{i + 1}</span>
                <span className="flex-1 truncate text-neutral-700">{name}</span>
                <span className="font-semibold text-neutral-900">{qty} un.</span>
                <div className="w-24 h-1.5 rounded-full bg-neutral-100">
                  <div
                    className="h-1.5 rounded-full bg-brand-400"
                    style={{ width: `${Math.round((qty / (topProdutos[0]?.[1] ?? 1)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela de pedidos */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-bold text-neutral-700">Pedidos do período ({filtered.length})</h2>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-neutral-400">Nenhum pedido no período selecionado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 text-left">Pedido</th>
                  <th className="px-4 py-3 text-left">Data</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-700">
                      #{order.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{fullDate(order.createdAt)}</td>
                    <td className="px-4 py-3 text-neutral-700 max-w-[160px] truncate">{order.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">{formatCurrency(order.totalInCents)}</td>
                    <td className="px-4 py-3 text-neutral-500">{order.status}</td>
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
