'use client'

import {
  callSetUserRole,
  deleteProdutor,
  setProdutorStatus,
} from '@marketplace/shared-services'
import type { Produtor, ProdutorStatus } from '@marketplace/shared-types'
import { useAuth } from '@marketplace/shared-services'
import { useAdminData } from '@/components/AdminDataProvider'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

type Tab = 'pending' | 'approved' | 'rejected' | 'suspended'

const TAB_LABELS: Record<Tab, string> = {
  pending: 'Pendentes',
  approved: 'Aprovados',
  rejected: 'Rejeitados',
  suspended: 'Suspensos',
}

const STATUS_BADGE: Record<ProdutorStatus, { label: string; cls: string }> = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700' },
  approved:  { label: 'Aprovado',  cls: 'bg-emerald-100 text-emerald-700' },
  rejected:  { label: 'Rejeitado', cls: 'bg-red-100 text-red-700' },
  suspended: { label: 'Suspenso',  cls: 'bg-neutral-200 text-neutral-600' },
}

// ── Modal de exclusão ─────────────────────────────────────────────────────────

interface DeleteModalProps {
  produtor: Produtor
  onConfirm: () => Promise<void>
  onClose: () => void
}

function DeleteModal({ produtor, onConfirm, onClose }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    await onConfirm()
    setDeleting(false)
  }

  return (
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
            onClick={onClose}
            disabled={deleting}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Deletando…' : 'Sim, deletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de rejeição ─────────────────────────────────────────────────────────

interface RejectModalProps {
  produtor: Produtor
  onConfirm: (reason: string) => Promise<void>
  onClose: () => void
}

function RejectModal({ produtor, onConfirm, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) return
    setSaving(true)
    await onConfirm(reason.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-bold text-neutral-900">Rejeitar produtor</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Informe o motivo da rejeição. O produtor será notificado.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Horta: <span className="font-semibold text-neutral-900">{produtor.name}</span>
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Ex: Documentação insuficiente, localização fora da área de atuação..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!reason.trim() || saving}
              className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {saving ? 'Rejeitando…' : 'Confirmar rejeição'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function ProdutoresAdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab | null) ?? 'pending',
  )

  const { produtores: allProdutores, loading } = useAdminData()
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Produtor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Produtor | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tab = searchParams.get('tab') as Tab | null
    if (tab) setActiveTab(tab)
  }, [searchParams])

  function changeTab(tab: Tab) {
    setActiveTab(tab)
    router.replace(`/produtores?tab=${tab}`)
  }

  async function handleApprove(produtor: Produtor) {
    if (!user) return
    setActionId(produtor.id)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'approved', { approvedBy: user.uid })
      await callSetUserRole({
        uid: produtor.ownerUid,
        role: 'produtor',
        produtorIds: [produtor.id],
        approved: true,
      })
    } catch {
      setError(`Erro ao aprovar ${produtor.name}. Tente novamente.`)
    } finally {
      setActionId(null)
    }
  }

  async function handleReject(produtor: Produtor, reason: string) {
    setActionId(produtor.id)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'rejected', { rejectionReason: reason })
    } catch {
      setError(`Erro ao rejeitar ${produtor.name}. Tente novamente.`)
    } finally {
      setActionId(null)
      setRejectTarget(null)
    }
  }

  async function handleSuspend(produtor: Produtor) {
    setActionId(produtor.id)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'suspended')
    } catch {
      setError(`Erro ao suspender ${produtor.name}. Tente novamente.`)
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(produtor: Produtor) {
    setActionId(produtor.id)
    setError(null)
    try {
      await deleteProdutor(produtor.id)
      // Revoga o custom claim para impedir acesso ao app produtor após deleção
      await callSetUserRole({ uid: produtor.ownerUid, role: 'cliente' }).catch(() => {})
      setDeleteTarget(null)
    } catch {
      setError(`Erro ao deletar ${produtor.name}. Tente novamente.`)
    } finally {
      setActionId(null)
    }
  }

  async function handleReactivate(produtor: Produtor) {
    if (!user) return
    setActionId(produtor.id)
    setError(null)
    try {
      await setProdutorStatus(produtor.id, 'approved', { approvedBy: user.uid })
      await callSetUserRole({
        uid: produtor.ownerUid,
        role: 'produtor',
        produtorIds: [produtor.id],
        approved: true,
      })
    } catch {
      setError(`Erro ao reativar ${produtor.name}. Tente novamente.`)
    } finally {
      setActionId(null)
    }
  }

  const filtered = allProdutores.filter((p) => p.status === activeTab)

  const tabCounts: Record<Tab, number> = {
    pending:   allProdutores.filter((p) => p.status === 'pending').length,
    approved:  allProdutores.filter((p) => p.status === 'approved').length,
    rejected:  allProdutores.filter((p) => p.status === 'rejected').length,
    suspended: allProdutores.filter((p) => p.status === 'suspended').length,
  }

  return (
    <>
      {rejectTarget && (
        <RejectModal
          produtor={rejectTarget}
          onConfirm={(reason) => handleReject(rejectTarget, reason)}
          onClose={() => setRejectTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          produtor={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Produtores</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Gerencie os cadastros de hortas na plataforma.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Tabs de status */}
        <div className="flex gap-1 rounded-xl border border-neutral-200 bg-neutral-100 p-1">
          {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => changeTab(tab)}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700',
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
              {tabCounts[tab] > 0 && (
                <span
                  className={[
                    'rounded-full px-1.5 py-0.5 text-xs font-bold',
                    tab === 'pending'
                      ? 'bg-amber-400 text-amber-900'
                      : 'bg-neutral-200 text-neutral-600',
                  ].join(' ')}
                >
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-neutral-200" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-400">
            <span className="text-3xl">🌱</span>
            <span>Nenhum produtor {TAB_LABELS[activeTab].toLowerCase()} no momento.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((produtor) => {
              const badge = STATUS_BADGE[produtor.status]
              const isActing = actionId === produtor.id

              return (
                <div
                  key={produtor.id}
                  className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                >
                  {/* Identidade */}
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/produtores/${produtor.id}`}
                        className="truncate font-semibold text-neutral-900 hover:text-brand-600 hover:underline"
                      >
                        {produtor.name}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-neutral-500">
                      {produtor.address.city}, {produtor.address.state} · {produtor.phone}
                    </p>
                    {produtor.email && (
                      <p className="mt-0.5 truncate text-xs text-neutral-400">{produtor.email}</p>
                    )}
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Cadastrado em{' '}
                      {produtor.createdAt?.toDate
                        ? produtor.createdAt.toDate().toLocaleDateString('pt-BR')
                        : '—'}
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <Link
                      href={`/produtores/${produtor.id}`}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-neutral-400 hover:bg-neutral-50"
                    >
                      Ver detalhes
                    </Link>

                    {produtor.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(produtor)}
                          disabled={isActing}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {isActing ? '…' : 'Aprovar'}
                        </button>
                        <button
                          onClick={() => setRejectTarget(produtor)}
                          disabled={isActing}
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                        >
                          Rejeitar
                        </button>
                      </>
                    )}

                    {produtor.status === 'approved' && (
                      <button
                        onClick={() => handleSuspend(produtor)}
                        disabled={isActing}
                        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        {isActing ? '…' : 'Suspender'}
                      </button>
                    )}

                    {produtor.status === 'suspended' && (
                      <button
                        onClick={() => handleReactivate(produtor)}
                        disabled={isActing}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {isActing ? '…' : 'Reativar'}
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteTarget(produtor)}
                      disabled={isActing}
                      title="Deletar produtor"
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
