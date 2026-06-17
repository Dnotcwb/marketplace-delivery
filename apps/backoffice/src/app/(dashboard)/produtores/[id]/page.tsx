'use client'

import {
  callGenerateAccessLink,
  callSetUserRole,
  deleteProdutor,
  getProdutorById,
  setProdutorStatus,
  toggleProdutorOpen,
  updateProdutor,
} from '@marketplace/shared-services'
import { useAuth } from '@marketplace/shared-services'
import type { Produtor, ProdutorCertification } from '@marketplace/shared-types'
import { firestore } from '@marketplace/shared-firebase'
import { doc, getDoc } from 'firebase/firestore'
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
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null)
  const [acting, setActing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [commissionInput, setCommissionInput] = useState('')
  const [savingCommission, setSavingCommission] = useState(false)
  const [commissionStatus, setCommissionStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  const [accessLink, setAccessLink] = useState<string | null>(null)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    if (!id) return
    getProdutorById(id).then(async (p) => {
      setProdutor(p ?? null)
      if (p) {
        setCommissionInput(String(p.commission))
        // Usa email salvo no documento; caso ausente (cadastros antigos), busca do users/{uid}
        if (p.email) {
          setOwnerEmail(p.email)
        } else {
          const userSnap = await getDoc(doc(firestore, 'users', p.ownerUid))
          setOwnerEmail((userSnap.data()?.['email'] as string | undefined) ?? null)
        }
      }
    })
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

  async function handleGenerateAccessLink() {
    if (!produtor) return
    setGeneratingLink(true)
    setLinkError(null)
    setLinkCopied(false)
    try {
      const result = await callGenerateAccessLink(produtor.ownerUid)
      setAccessLink(result.link)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setLinkError(msg || 'Erro ao gerar o link. Tente novamente.')
    } finally {
      setGeneratingLink(false)
    }
  }

  async function handleCopyAccessLink() {
    if (!accessLink) return
    try {
      await navigator.clipboard.writeText(accessLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // navegador sem clipboard API — o input permite selecionar e copiar manualmente
    }
  }

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

  async function handleToggleOpen() {
    if (!produtor) return
    setActing(true)
    setError(null)
    try {
      await toggleProdutorOpen(produtor.id, !produtor.isOpen)
      setProdutor((p) => p ? { ...p, isOpen: !p.isOpen } : p)
    } catch {
      setError('Erro ao alterar status. Tente novamente.')
    } finally {
      setActing(false)
    }
  }


  async function handleSaveCommission() {
    if (!produtor) return
    const pct = parseFloat(commissionInput)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    setSavingCommission(true)
    setCommissionStatus('idle')
    try {
      await updateProdutor(produtor.id, { commission: pct })
      setProdutor((p) => p ? { ...p, commission: pct } : p)
      setCommissionStatus('ok')
      setTimeout(() => setCommissionStatus('idle'), 3000)
    } catch {
      setCommissionStatus('err')
    } finally {
      setSavingCommission(false)
    }
  }

  async function handleDelete() {
    if (!produtor) return
    setActing(true)
    setError(null)
    try {
      await deleteProdutor(produtor.id)
      // Revoga o custom claim para impedir acesso ao app produtor após deleção
      await callSetUserRole({ uid: produtor.ownerUid, role: 'cliente' }).catch(() => {})
      router.push('/produtores')
    } catch {
      setError('Erro ao deletar. Tente novamente.')
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
      {/* Modal de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="mb-1 text-lg font-bold text-neutral-900">Deletar produtor</h2>
            <p className="mb-1 text-sm text-neutral-600">
              Tem certeza que deseja deletar <span className="font-semibold text-neutral-900">{produtor.name}</span>?
            </p>
            <p className="mb-6 text-sm text-red-600">
              Esta ação é irreversível. O documento será removido permanentemente do Firestore.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={acting}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={acting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {acting ? 'Deletando…' : 'Sim, deletar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900">{produtor.name}</h1>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
              {badge.label}
            </span>
            {produtor.status === 'approved' && (
              <button
                type="button"
                onClick={handleToggleOpen}
                disabled={acting}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors disabled:opacity-50',
                  produtor.isOpen
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-neutral-300 bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                ].join(' ')}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${produtor.isOpen ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                {produtor.isOpen ? 'Aberta — clique para fechar' : 'Fechada — clique para abrir'}
              </button>
            )}
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
            <InfoRow label="E-mail" value={ownerEmail ?? '—'} />
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

        {/* Deletar */}
        <div className="mt-5 border-t border-red-100 pt-5">
          <p className="mb-2 text-sm font-semibold text-red-700">Zona de perigo</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            disabled={acting}
            className="rounded-lg border border-red-300 px-5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            Deletar produtor permanentemente
          </button>
          <p className="mt-1 text-xs text-neutral-400">Esta ação não pode ser desfeita.</p>
        </div>

        {/* Acesso do produtor (reset de senha) */}
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <p className="mb-1 text-sm font-semibold text-neutral-700">Acesso do produtor</p>
          <p className="mb-3 text-xs text-neutral-400">
            Gera um link de redefinição de senha para enviar ao produtor por WhatsApp ou
            outro canal — útil quando o e-mail do cadastro não recebe mensagens.
          </p>

          {!accessLink ? (
            <button
              onClick={handleGenerateAccessLink}
              disabled={generatingLink}
              className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              {generatingLink ? 'Gerando…' : '🔑 Gerar link de redefinição de senha'}
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-medium text-emerald-700">
                Link gerado — copie e envie ao produtor:
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={accessLink}
                  onFocus={(e) => e.target.select()}
                  className="w-full flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs text-neutral-700 focus:outline-none"
                />
                <button
                  onClick={handleCopyAccessLink}
                  className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {linkCopied ? '✓ Copiado!' : 'Copiar'}
                </button>
              </div>
              <button
                onClick={() => { setAccessLink(null); setLinkCopied(false) }}
                className="text-xs font-medium text-neutral-500 hover:underline"
              >
                Gerar novo link
              </button>
            </div>
          )}
          {linkError && <p className="mt-2 text-xs text-red-600">{linkError}</p>}
        </div>

        {/* Comissão */}
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <p className="mb-2 text-sm font-semibold text-neutral-700">Comissão da plataforma</p>
          <div className="flex items-center gap-3">
            <div className="relative w-32">
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={commissionInput}
                onChange={(e) => setCommissionInput(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-7 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
            </div>
            <button
              onClick={handleSaveCommission}
              disabled={savingCommission}
              className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {savingCommission ? 'Salvando…' : 'Salvar'}
            </button>
            {commissionStatus === 'ok' && <span className="text-sm text-emerald-600">Salvo!</span>}
            {commissionStatus === 'err' && <span className="text-sm text-red-500">Erro ao salvar.</span>}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Comissão atual: {produtor.commission}%</p>
        </div>

        {/* Stripe Connect (recebimento) */}
        <div className="mt-5 border-t border-neutral-100 pt-5">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm font-semibold text-neutral-700">Recebimento (Stripe)</p>
            {produtor.stripeOnboarded ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Conectado
              </span>
            ) : produtor.stripeAccountId ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Cadastro pendente
              </span>
            ) : (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                Não conectado
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400">
            O próprio produtor conecta a conta Stripe pelo app dele. Quando o status
            fica <span className="font-semibold">Conectado</span>, ele passa a poder vender
            e recebe automaticamente sua parte de cada pedido (split por Stripe Transfer).
          </p>
          {produtor.stripeAccountId && (
            <p className="mt-2 font-mono text-xs text-neutral-400">
              Conta: {produtor.stripeAccountId}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
