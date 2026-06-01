'use client'

import { subscribeToPedidoFilhos } from '@marketplace/shared-services'
import type { PedidoFilho } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { Timestamp } from 'firebase/firestore'
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

function filhoSubtotal(filho: PedidoFilho): number {
  return filho.items.reduce((s, i) => s + i.priceInCents * i.quantity, 0)
}

const COMPLETED_STATUSES = new Set(['aceito', 'em_preparo', 'separado', 'retirado', 'entregue'])

function exportCsv(filhos: PedidoFilho[], produtorName: string) {
  const rows = [
    ['Pedido Pai', 'Data', 'Cliente', 'Itens', 'Subtotal (R$)', 'Repasse (R$)', 'Status'],
    ...filhos.map((f) => [
      f.pedidoPaiId.slice(0, 8).toUpperCase(),
      fullDate(f.createdAt),
      f.customerName ?? '',
      f.items.map((i) => `${i.quantity}x ${i.productName}`).join(' | '),
      (filhoSubtotal(f) / 100).toFixed(2).replace('.', ','),
      (f.valorRepasseInCents / 100).toFixed(2).replace('.', ','),
      f.status,
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
  const [allFilhos, setAllFilhos] = useState<PedidoFilho[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('7')

  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const unsub = subscribeToPedidoFilhos(produtor.id, (filhos) => {
      setAllFilhos(filhos)
      setLoading(false)
    })

    return unsub
  }, [prodLoading, produtor])

  const filtered = useMemo(() => {
    const cutoff = startOf(Number(period))
    return allFilhos.filter((f) => {
      const ts = (f.createdAt as unknown as { seconds: number })?.seconds ?? 0
      return ts >= cutoff.seconds
    })
  }, [allFilhos, period])

  const completed = useMemo(() =>
    filtered.filter((f) => COMPLETED_STATUSES.has(f.status)),
  [filtered])

  const faturamento = completed.reduce((s, f) => s + filhoSubtotal(f), 0)
  const ticket = completed.length > 0 ? Math.round(faturamento / completed.length) : 0

  const topProdutos = useMemo(() => {
    const map: Record<string, number> = {}
    completed.forEach((f) => f.items.forEach((i) => {
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total de pedidos', value: String(filtered.length), icon: '📦' },
          { label: 'Pedidos concluídos', value: String(completed.length), icon: '✅' },
          { label: 'Faturamento', value: formatCurrency(faturamento), icon: '💰' },
          { label: 'Ticket médio', value: ticket ? formatCurrency(ticket) : '—', icon: '🧾' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm">
            <div className="mb-1 text-xl sm:text-2xl">{kpi.icon}</div>
            <p className="text-lg sm:text-2xl font-bold text-neutral-900 truncate">{kpi.value}</p>
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
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3 text-right">Repasse</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((filho) => (
                  <tr key={filho.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-700">
                      #{filho.pedidoPaiId.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{fullDate(filho.createdAt)}</td>
                    <td className="px-4 py-3 text-neutral-700 max-w-[160px] truncate">{filho.customerName ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-neutral-900">{formatCurrency(filhoSubtotal(filho))}</td>
                    <td className="px-4 py-3 text-right text-brand-700 font-semibold">{formatCurrency(filho.valorRepasseInCents)}</td>
                    <td className="px-4 py-3 text-neutral-500">{filho.status}</td>
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
