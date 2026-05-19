'use client'

import Link from 'next/link'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

export default function DashboardPage() {
  const { produtor, loading } = useProdutorAtivo()

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  // Produtor ainda não criou o perfil
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

  // Aguardando aprovação
  if (produtor.status === 'pending') {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-20">
        <div className="max-w-md text-center">
          <div className="mb-4 text-5xl">⏳</div>
          <h1 className="mb-2 text-2xl font-bold text-neutral-900">Aguardando aprovação</h1>
          <p className="text-neutral-500">
            Seu cadastro está em análise. Nossa equipe irá revisar as informações e você será
            notificado por e-mail quando sua horta for aprovada.
          </p>
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Prazo médio de análise: até 2 dias úteis.
          </div>
        </div>
      </div>
    )
  }

  // Produtor aprovado — dashboard com métricas (Etapa 4 terá dados reais)
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Olá, {produtor.name}! 🌿</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Aqui está um resumo do desempenho da sua horta hoje.
        </p>
      </div>

      {/* Cards de métricas — placeholder até Etapa 4 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Pedidos hoje', value: '—', icon: '📦' },
          { label: 'Faturamento hoje', value: '—', icon: '💰' },
          { label: 'Ticket médio', value: '—', icon: '🧾' },
          { label: 'Avaliação média', value: '—', icon: '⭐' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="mb-1 text-2xl">{card.icon}</div>
            <p className="text-2xl font-bold text-neutral-900">{card.value}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Atalhos rápidos */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-neutral-700">Atalhos rápidos</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/catalogo"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600"
          >
            Gerenciar catálogo
          </Link>
          <Link
            href="/pedidos"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600"
          >
            Ver pedidos
          </Link>
          <Link
            href="/configuracoes"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600"
          >
            Configurações
          </Link>
        </div>
      </div>
    </div>
  )
}
