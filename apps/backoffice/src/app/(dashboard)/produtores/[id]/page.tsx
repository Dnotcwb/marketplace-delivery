'use client'

import {
  callSetUserRole,
  getProdutorById,
  setProdutorStatus,
} from '@marketplace/shared-services'
import { useAuth } from '@marketplace/shared-services'
import type { Produtor, ProdutorCertification } from '@marketplace/shared-types'
import Image from 'next/image'
import Link from 'next/link'
import { notFound, useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const CERT_LABELS: Record<ProdutorCertification, string> = {
  organico: 'Orgânico',
  agroecologico: 'Agroecológico',
  natural: 'Natural',
  biodynamico: 'Biodinâmico',
  sem_agrotoxicos: 'Sem agrotóxicos',
}

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  approved:  { label: 'Aprovado',  cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected:  { label: 'Rejeitado', cls: 'bg-red-100 text-red-700 border-red-200' },
  suspended: { label: 'Suspenso',  cls: 'bg-neutral-200 text-neutral-700 border-neutral-300' },
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 text-sm">
      <span className="w-40 flex-shrink-0 font-medium text-neutral-500">{label}</span>
      <span className="text-neutral-900">{value}</span>
    </div>
  )
}

export default function ProdutorDetailPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''
  const { user } = useAuth()
  const router = useRouter()

  const [produtor, setProdutor] = useState<Produtor | null | undefined>(undefined)
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    getProdutorById(id).then((p) => setProdutor(p ?? null))
  }, [id])

  if (produtor === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (produtor === null) {
    notFound()
  }

  const badge = STATUS_BADGE[produtor.status]

  async function handleApprove() {
    if (!user || !produtor) return
    setActing(true)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'approved', { approvedBy: user.uid })
      await callSetUserRole({
        uid: produtor.ownerUid,
        role: 'produtor',
        produtorIds: [produtor.id],
        approved: true,
      })
      router.push('/produtores?tab=approved')
    } catch {
      setError('Erro ao aprovar. Tente novamente.')
    } finally {
      setActing(false)
    }
  }

  async function handleReject() {
    if (!produtor || !rejectReason.trim()) return
    setActing(true)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'rejected', { rejectionReason: rejectReason.trim() })
      router.push('/produtores?tab=rejected')
    } catch {
      setError('Erro ao rejeitar. Tente novamente.')
    } finally {
      setActing(false)
    }
  }

  async function handleSuspend() {
    if (!produtor) return
    setActing(true)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'suspended')
      router.push('/produtores?tab=suspended')
    } catch {
      setError('Erro ao suspender. Tente novamente.')
    } finally {
      setActing(false)
    }
  }

  const formatCurrency = (cents: number) =>
    cents === 0
      ? 'Grátis'
      : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Link
          href="/produtores"
          className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Voltar"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900">{produtor.name}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-neutral-500">ID: {produtor.id}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Banner e logo */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="relative h-40 w-full bg-neutral-100">
          {produtor.bannerUrl ? (
            <Image src={produtor.bannerUrl} alt="Banner" fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200">
              <span className="text-5xl opacity-40">🌿</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 p-5">
          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white shadow">
            {produtor.logoUrl ? (
              <Image src={produtor.logoUrl} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">
                {produtor.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="font-bold text-neutral-900">{produtor.name}</p>
            <p className="text-sm text-neutral-500">{produtor.description}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Informações básicas */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Dados cadastrais
          </h2>
          <div className="divide-y divide-neutral-100">
            <InfoRow label="Telefone" value={produtor.phone} />
            <InfoRow label="Documento" value={produtor.document ?? 'Não informado'} />
            <InfoRow label="Slug (URL)" value={produtor.slug} />
            <InfoRow
              label="Criado em"
              value={produtor.createdAt?.toDate
                ? produtor.createdAt.toDate().toLocaleString('pt-BR')
                : '—'}
            />
            {produtor.approvedAt && (
              <InfoRow
                label="Aprovado em"
                value={produtor.approvedAt.toDate().toLocaleString('pt-BR')}
              />
            )}
            {produtor.rejectionReason && (
              <InfoRow label="Motivo rejeição" value={produtor.rejectionReason} />
            )}
          </div>
        </div>

        {/* Endereço */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Endereço
          </h2>
          <div className="divide-y divide-neutral-100">
            <InfoRow label="CEP" value={produtor.address.cep} />
            <InfoRow label="Logradouro" value={`${produtor.address.street}, ${produtor.address.number}${produtor.address.complement ? ` — ${produtor.address.complement}` : ''}`} />
            <InfoRow label="Bairro" value={produtor.address.neighborhood} />
            <InfoRow label="Cidade/UF" value={`${produtor.address.city} / ${produtor.address.state}`} />
          </div>
        </div>

        {/* Operação */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Operação
          </h2>
          <div className="divide-y divide-neutral-100">
            <InfoRow label="Taxa de entrega" value={formatCurrency(produtor.deliveryFeeInCents)} />
            <InfoRow label="Pedido mínimo" value={formatCurrency(produtor.minOrderValueInCents)} />
            <InfoRow label="Tempo estimado" value={`${produtor.estimatedDeliveryTimeMin}–${produtor.estimatedDeliveryTimeMax} min`} />
            <InfoRow label="Comissão" value={`${produtor.commission}%`} />
          </div>
        </div>

        {/* Certificações e horários */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Certificações
          </h2>
          {produtor.certifications.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {produtor.certifications.map((c) => (
                <span key={c} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                  {CERT_LABELS[c]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Nenhuma certificação informada.</p>
          )}

          <h2 className="mb-3 mt-5 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Horários
          </h2>
          <div className="space-y-1">
            {produtor.openingHours.map((h) => (
              <div key={h.dayOfWeek} className="flex justify-between text-sm">
                <span className={h.open ? 'font-medium text-neutral-900' : 'text-neutral-400'}>
                  {DAYS[h.dayOfWeek]}
                </span>
                <span className={h.open ? 'text-neutral-700' : 'text-neutral-400'}>
                  {h.open ? `${h.openTime} – ${h.closeTime}` : 'Fechado'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Painel de ações */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Ações administrativas
        </h2>

        {produtor.status === 'pending' && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={acting}
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {acting ? 'Processando…' : '✓ Aprovar cadastro'}
              </button>
              <button
                onClick={() => setShowRejectForm((v) => !v)}
                disabled={acting}
                className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Rejeitar cadastro
              </button>
            </div>

            {showRejectForm && (
              <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <label className="block text-sm font-medium text-red-700">
                  Motivo da rejeição
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Ex: Documentação insuficiente..."
                  className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                />
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim() || acting}
                  className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Confirmar rejeição
                </button>
              </div>
            )}
          </div>
        )}

        {produtor.status === 'approved' && (
          <button
            onClick={handleSuspend}
            disabled={acting}
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {acting ? 'Suspendendo…' : 'Suspender produtor'}
          </button>
        )}

        {(produtor.status === 'rejected' || produtor.status === 'suspended') && (
          <button
            onClick={handleApprove}
            disabled={acting}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
          >
            {acting ? 'Processando…' : 'Aprovar e reativar'}
          </button>
        )}
      </div>
    </div>
  )
}
