'use client'

import { firestore } from '@marketplace/shared-firebase'
import { formatCurrency } from '@marketplace/shared-utils'
import type { Order } from '@marketplace/shared-types'
import { collection, onSnapshot, query, Timestamp, where } from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

interface DashboardStats {
  pedidosHoje: number
  faturamentoHoje: number
  ticketMedio: number
  topProdutos: { name: string; qty: number }[]
  pedidosAtivos: number
}

function startOfToday(): Timestamp {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return Timestamp.fromDate(d)
}

export default function DashboardPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    if (prodLoading || !produtor?.id || produtor.status !== 'approved') {
      if (!prodLoading) setStatsLoading(false)
      return
    }

    // Todos os pedidos do produtor (para ativos + histórico do dia)
    const q = query(
      collection(firestore, 'orders'),
      where('produtorId', '==', produtor.id),
    )

    const todayTs = startOfToday()

    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)

      const todayOrders = orders.filter((o) => {
        const ts = o.createdAt as unknown as { seconds: number }
        return ts?.seconds >= todayTs.seconds
      })

      const completedToday = todayOrders.filter((o) =>
        ['confirmed', 'accepted', 'preparing', 'ready', 'on_delivery', 'delivered'].includes(o.status),
      )

      const faturamento = completedToday.reduce((sum, o) => sum + o.totalInCents, 0)
      const ticketMedio = completedToday.length > 0 ? Math.round(faturamento / completedToday.length) : 0

      // Top produtos do dia
      const prodQty: Record<string, number> = {}
      completedToday.forEach((o) => {
        o.items.forEach((item) => {
          prodQty[item.productName] = (prodQty[item.productName] ?? 0) + item.quantity
        })
      })
      const topProdutos = Object.entries(prodQty)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, qty]) => ({ name, qty }))

      const pedidosAtivos = orders.filter((o) =>
        ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'on_delivery'].includes(o.status),
      ).length

      setStats({
        pedidosHoje: todayOrders.length,
        faturamentoHoje: faturamento,
        ticketMedio,
        topProdutos,
        pedidosAtivos,
      })
      setStatsLoading(false)
    }, (err) => {
      console.error('dashboard stats error:', err)
      setStatsLoading(false)
    })

    return unsub
  }, [prodLoading, produtor])

  if (prodLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!produtor) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">🌱</div>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Configure sua horta</h1>
          <p className="mb-6 text-neutral-500">
            Complete o cadastro da sua horta para começar a receber pedidos na plataforma.
          </p>
          <Link
            href="/configurar"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
          >
            Iniciar cadastro →
          </Link>
        </div>
      </div>
    )
  }

  if (produtor.status === 'pending') {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">⏳</div>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Aguardando aprovação</h1>
          <p className="text-neutral-500">
            Seu cadastro está em análise. Você será notificado por e-mail quando sua horta for aprovada.
          </p>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Prazo médio de análise: até 2 dias úteis.
          </div>
        </div>
      </div>
    )
  }

  const kpis = [
    {
      label: 'Pedidos hoje',
      value: statsLoading ? '—' : String(stats?.pedidosHoje ?? 0),
      icon: '📦',
      sub: stats?.pedidosAtivos ? `${stats.pedidosAtivos} ativo${stats.pedidosAtivos !== 1 ? 's' : ''}` : undefined,
      href: '/pedidos',
    },
    {
      label: 'Faturamento hoje',
      value: statsLoading ? '—' : formatCurrency(stats?.faturamentoHoje ?? 0),
      icon: '💰',
      sub: undefined,
      href: undefined,
    },
    {
      label: 'Ticket médio',
      value: statsLoading ? '—' : (stats?.ticketMedio ? formatCurrency(stats.ticketMedio) : '—'),
      icon: '🧾',
      sub: undefined,
      href: undefined,
    },
    {
      label: 'Pedidos ativos',
      value: statsLoading ? '—' : String(stats?.pedidosAtivos ?? 0),
      icon: '🔄',
      sub: undefined,
      href: '/pedidos',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Olá, {produtor.name}! 🌿</h1>
        <p className="mt-1 text-sm text-neutral-500">Resumo de hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-neutral-200 bg-white p-3 sm:p-5 shadow-sm"
          >
            <div className="mb-1 text-xl sm:text-2xl">{kpi.icon}</div>
            <p className="text-lg sm:text-2xl font-bold text-neutral-900 truncate">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{kpi.label}</p>
            {kpi.sub && (
              <p className="mt-1 text-xs font-semibold text-brand-600">{kpi.sub}</p>
            )}
            {kpi.href && (
              <Link href={kpi.href} className="mt-2 block text-xs text-brand-500 hover:underline">
                Ver detalhes →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Top produtos */}
      {!statsLoading && stats && stats.topProdutos.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold text-neutral-700">Produtos mais vendidos hoje</h2>
          <ul className="space-y-2">
            {stats.topProdutos.map((p, i) => (
              <li key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center font-bold text-neutral-400">{i + 1}</span>
                <span className="flex-1 text-neutral-700 truncate">{p.name}</span>
                <span className="font-semibold text-neutral-900">{p.qty} un.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Atalhos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Atalhos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/pedidos" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Gerenciar pedidos
          </Link>
          <Link href="/catalogo" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Editar catálogo
          </Link>
          <Link href="/pedidos/historico" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600">
            Histórico de pedidos
          </Link>
        </div>
      </div>
    </div>
  )
}
