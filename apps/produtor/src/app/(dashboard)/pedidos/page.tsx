'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { FilhoStatus, PedidoFilho } from '@marketplace/shared-types'
import { FILHO_STATUS_LABELS, PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

// ──────────────────────────────────────────────────────
//  Configuração das colunas Kanban
// ──────────────────────────────────────────────────────

interface KanbanColumn {
  key: string
  label: string
  statuses: FilhoStatus[]
  headerCls: string
  badgeCls: string
}

const COLUMNS: KanbanColumn[] = [
  {
    key: 'novos',
    label: 'Novos pedidos',
    statuses: ['pendente'],
    headerCls: 'bg-amber-50 border-amber-200',
    badgeCls: 'bg-amber-500',
  },
  {
    key: 'preparo',
    label: 'Em preparo',
    statuses: ['aceito', 'em_preparo'],
    headerCls: 'bg-purple-50 border-purple-200',
    badgeCls: 'bg-purple-500',
  },
  {
    key: 'separados',
    label: 'Separados',
    statuses: ['separado'],
    headerCls: 'bg-indigo-50 border-indigo-200',
    badgeCls: 'bg-indigo-500',
  },
]

const NEXT_STATUS: Partial<Record<FilhoStatus, FilhoStatus>> = {
  pendente:   'aceito',
  aceito:     'em_preparo',
  em_preparo: 'separado',
}

const ACTION_LABEL: Partial<Record<FilhoStatus, string>> = {
  pendente:   'Aceitar',
  aceito:     'Iniciar preparo',
  em_preparo: 'Separado',
}

// ──────────────────────────────────────────────────────
//  Alerta sonoro
// ──────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      _audioCtx = new (window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
    }
    return _audioCtx
  } catch {
    return null
  }
}

function playBeep(ctx: AudioContext, t: number) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.type = 'sine'
  osc.frequency.value = 1050
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.55, t + 0.04)
  gain.gain.setValueAtTime(0.55, t + 0.14)
  gain.gain.linearRampToValueAtTime(0, t + 0.22)
  osc.start(t)
  osc.stop(t + 0.25)
}

function playNewOrderAlert() {
  const ctx = getAudioCtx()
  if (!ctx) return
  const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve()
  resume.then(() => {
    const now = ctx.currentTime
    playBeep(ctx, now)
    playBeep(ctx, now + 0.35)
    playBeep(ctx, now + 0.70)
  }).catch(() => undefined)
}

// ──────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────

function tsToDate(ts: unknown): Date | null {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return null
  try { return (ts as Timestamp).toDate() } catch { return null }
}

function timeAgo(ts: unknown): string {
  const d = tsToDate(ts)
  if (!d) return '—'
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h`
}

function fullDate(ts: unknown): string {
  const d = tsToDate(ts)
  if (!d) return '—'
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ──────────────────────────────────────────────────────
//  Comanda para impressão
// ──────────────────────────────────────────────────────

function PrintableTicket({ filho, produtorName }: { filho: PedidoFilho; produtorName: string }) {
  return (
    <div
      id="comanda-print"
      className="hidden print:block fixed inset-0 bg-white z-[9999] p-4"
      style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.4' }}
    >
      <div style={{ maxWidth: '72mm', margin: '0 auto' }}>
        <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{produtorName}</p>
        <p style={{ textAlign: 'center' }}>COMANDA DE PEDIDO</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>
        <p><strong>Pedido:</strong> #{filho.pedidoPaiId.slice(0, 8).toUpperCase()}</p>
        <p><strong>Data:</strong> {fullDate(filho.createdAt)}</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>
        <p><strong>Cliente:</strong> {filho.customerName || '—'}</p>
        {filho.customerPhone && <p><strong>Tel:</strong> {filho.customerPhone}</p>}
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>
        <p><strong>Entrega:</strong></p>
        <p>{filho.deliveryAddress.recipientName}</p>
        <p>{filho.deliveryAddress.street}, {filho.deliveryAddress.number}
          {filho.deliveryAddress.complement ? `, ${filho.deliveryAddress.complement}` : ''}
        </p>
        <p>{filho.deliveryAddress.neighborhood} — {filho.deliveryAddress.city}/{filho.deliveryAddress.state}</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>
        <p><strong>ITENS</strong></p>
        {filho.items.map((item, i) => (
          <div key={i}>
            <p>{item.quantity}{PRODUCT_UNIT_LABELS[item.unit]} {item.productName}</p>
            {item.notes && <p style={{ paddingLeft: '12px' }}>* {item.notes}</p>}
            <p style={{ textAlign: 'right' }}>{formatCurrency(item.priceInCents * item.quantity)}</p>
          </div>
        ))}
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>
        <p style={{ fontWeight: 'bold', fontSize: '15px' }}>
          REPASSE: {formatCurrency(filho.valorRepasseInCents)}
        </p>
        <p style={{ textAlign: 'center', marginTop: '8px' }}>Obrigado! 🌿</p>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Modal de detalhes do pedido filho
// ──────────────────────────────────────────────────────

function FilhoDetailModal({
  filho,
  onClose,
  onAdvance,
  onCancel,
  onPrint,
  updating,
}: {
  filho: PedidoFilho
  onClose: () => void
  onAdvance: () => void
  onCancel: () => void
  onPrint: () => void
  updating: boolean
}) {
  const canAdvance = !!NEXT_STATUS[filho.status]
  const canCancel = ['pendente', 'aceito'].includes(filho.status)
  const isTerminal = ['separado', 'cancelado'].includes(filho.status)

  return (
    <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
          <div>
            <p className="font-bold text-neutral-900 font-mono">#{filho.pedidoPaiId.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-neutral-400">{fullDate(filho.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
            >
              🖨️ Imprimir
            </button>
            <button onClick={onClose} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {/* Status */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
            {FILHO_STATUS_LABELS[filho.status]}
          </div>

          {/* Cliente */}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Cliente</p>
            <p className="font-semibold text-neutral-900">{filho.customerName || '—'}</p>
            {filho.customerPhone && <p className="text-sm text-neutral-500">{filho.customerPhone}</p>}
          </div>

          {/* Itens */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Itens</p>
            <ul className="space-y-2">
              {filho.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-10 shrink-0 text-center font-bold text-neutral-700">{item.quantity} {PRODUCT_UNIT_LABELS[item.unit]}</span>
                  <div className="flex-1">
                    <p className="font-medium text-neutral-900">{item.productName}</p>
                    {item.notes && <p className="text-xs text-neutral-400">Obs: {item.notes}</p>}
                  </div>
                  <span className="font-semibold text-neutral-900">{formatCurrency(item.priceInCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Endereço */}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Entrega</p>
            <p className="font-semibold text-neutral-900">{filho.deliveryAddress.recipientName}</p>
            <p className="text-sm text-neutral-500">
              {filho.deliveryAddress.street}, {filho.deliveryAddress.number}
              {filho.deliveryAddress.complement ? `, ${filho.deliveryAddress.complement}` : ''}
            </p>
            <p className="text-sm text-neutral-500">
              {filho.deliveryAddress.neighborhood} — {filho.deliveryAddress.city}/{filho.deliveryAddress.state}
            </p>
          </div>

          {/* Repasse */}
          <div className="flex justify-between rounded-xl border border-neutral-100 bg-neutral-50 p-3.5 text-sm">
            <span className="text-neutral-500">Repasse ao produtor</span>
            <span className="font-bold text-brand-600">{formatCurrency(filho.valorRepasseInCents)}</span>
          </div>

          {/* Ações */}
          {!isTerminal && (
            <div className="flex gap-2 pt-1">
              {canAdvance && (
                <button
                  onClick={onAdvance}
                  disabled={updating}
                  className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {updating ? '…' : ACTION_LABEL[filho.status]}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={onCancel}
                  disabled={updating}
                  className="rounded-xl border border-red-300 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Card no Kanban
// ──────────────────────────────────────────────────────

function KanbanCard({
  filho,
  onSelect,
  onAdvance,
  updating,
  isNew,
}: {
  filho: PedidoFilho
  onSelect: () => void
  onAdvance: (e: React.MouseEvent) => void
  updating: boolean
  isNew: boolean
}) {
  const canAdvance = !!NEXT_STATUS[filho.status]

  return (
    <div
      className={[
        'rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
        isNew ? 'border-amber-400 ring-2 ring-amber-200' : 'border-neutral-200',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-neutral-700">
            #{filho.pedidoPaiId.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-neutral-400">{timeAgo(filho.createdAt)}</span>
        </div>
        <p className="truncate text-sm font-semibold text-neutral-900">{filho.customerName || 'Cliente'}</p>
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {filho.items.length === 1
            ? `${filho.items[0]!.quantity} ${PRODUCT_UNIT_LABELS[filho.items[0]!.unit]} ${filho.items[0]!.productName}`
            : `${filho.items.length} itens · ${filho.items[0]!.productName}…`}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-bold text-brand-600">{formatCurrency(filho.valorRepasseInCents)}</span>
          {canAdvance && (
            <button
              onClick={onAdvance}
              disabled={updating}
              className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {updating ? '…' : ACTION_LABEL[filho.status]}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Coluna do Kanban
// ──────────────────────────────────────────────────────

function KanbanColumnView({
  column,
  filhos,
  newIds,
  onSelect,
  onAdvance,
  updatingId,
}: {
  column: KanbanColumn
  filhos: PedidoFilho[]
  newIds: Set<string>
  onSelect: (f: PedidoFilho) => void
  onAdvance: (f: PedidoFilho) => void
  updatingId: string | null
}) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-100 overflow-hidden">
      <div className={['flex items-center gap-2 border-b px-3 py-2.5', column.headerCls].join(' ')}>
        <span className="text-sm font-bold text-neutral-800">{column.label}</span>
        <span className={['ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white', column.badgeCls].join(' ')}>
          {filhos.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: '120px', maxHeight: '65vh' }}>
        {filhos.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-xs text-neutral-400">Nenhum pedido</div>
        ) : (
          filhos.map((f) => (
            <KanbanCard
              key={f.id}
              filho={f}
              isNew={newIds.has(f.id)}
              onSelect={() => onSelect(f)}
              onAdvance={(e) => { e.stopPropagation(); onAdvance(f) }}
              updating={updatingId === f.id}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function PedidosPage() {
  const { produtor, loading: prodLoading } = useProdutorAtivo()
  const [filhos, setFilhos] = useState<PedidoFilho[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFilho, setSelectedFilho] = useState<PedidoFilho | null>(null)
  const [printingFilho, setPrintingFilho] = useState<PedidoFilho | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  const isInitialRef = useRef(true)

  useEffect(() => {
    function unlock() {
      setAudioUnlocked(true)
      getAudioCtx()
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  useEffect(() => {
    if (!selectedFilho) return
    const updated = filhos.find((f) => f.id === selectedFilho.id)
    if (updated) setSelectedFilho(updated)
  }, [filhos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!printingFilho) return
    const timer = setTimeout(() => {
      window.print()
      const clear = () => { setPrintingFilho(null); window.removeEventListener('afterprint', clear) }
      window.addEventListener('afterprint', clear)
      setTimeout(() => { setPrintingFilho(null); window.removeEventListener('afterprint', clear) }, 8000)
    }, 150)
    return () => clearTimeout(timer)
  }, [printingFilho])

  // Listener em pedidos_filhos por produtorId
  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const q = query(
      collection(firestore, 'pedidos_filhos'),
      where('produtorId', '==', produtor.id),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const isInitial = isInitialRef.current
        isInitialRef.current = false

        if (!isInitial) {
          const added = snap
            .docChanges()
            .filter(
              (c) => c.type === 'added' &&
                (c.doc as QueryDocumentSnapshot).data()['status'] === 'pendente',
            )
          if (added.length > 0) {
            if (audioUnlocked) playNewOrderAlert()
            const ids = new Set(added.map((c) => c.doc.id))
            setNewIds((prev) => new Set([...prev, ...ids]))
            setTimeout(() => {
              setNewIds((prev) => {
                const next = new Set(prev)
                ids.forEach((id) => next.delete(id))
                return next
              })
            }, 10000)
          }
        }

        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PedidoFilho)
          .filter((f) => f.status !== 'cancelado')
          .sort((a, b) => {
            const aT = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0
            const bT = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0
            return bT - aT
          })

        setFilhos(list)
        setLoading(false)
      },
      (err) => {
        console.error('pedidos_filhos error:', err.code, err.message)
        setLoading(false)
      },
    )

    return unsub
  }, [prodLoading, produtor, audioUnlocked])

  async function handleAdvance(filho: PedidoFilho) {
    const nextStatus = NEXT_STATUS[filho.status]
    if (!nextStatus) return
    setUpdatingId(filho.id)
    try {
      await updateDoc(doc(firestore, 'pedidos_filhos', filho.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('Erro ao avançar status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCancel(filho: PedidoFilho) {
    if (!window.confirm(`Cancelar pedido #${filho.pedidoPaiId.slice(0, 8).toUpperCase()}?`)) return
    setUpdatingId(filho.id)
    try {
      await updateDoc(doc(firestore, 'pedidos_filhos', filho.id), {
        status: 'cancelado',
        updatedAt: serverTimestamp(),
      })
      if (selectedFilho?.id === filho.id) setSelectedFilho(null)
    } catch (err) {
      console.error('Erro ao cancelar:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  function handlePrint(filho: PedidoFilho) {
    setSelectedFilho(null)
    setTimeout(() => setPrintingFilho(filho), 50)
  }

  if (prodLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const activeFilhos = filhos.filter((f) =>
    ['pendente', 'aceito', 'em_preparo'].includes(f.status),
  )

  return (
    <>
      <div className="print:hidden flex flex-col gap-4 h-full">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Pedidos</h1>
          {activeFilhos.length > 0 && (
            <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {activeFilhos.length} ativo{activeFilhos.length !== 1 ? 's' : ''}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!audioUnlocked && (
              <span className="hidden sm:inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                Clique para ativar alertas sonoros
              </span>
            )}
            <Link href="/pedidos/historico" className="text-sm font-medium text-neutral-500 hover:text-brand-600 whitespace-nowrap">
              Ver histórico →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <KanbanColumnView
              key={col.key}
              column={col}
              filhos={filhos.filter((f) => col.statuses.includes(f.status))}
              newIds={newIds}
              onSelect={setSelectedFilho}
              onAdvance={handleAdvance}
              updatingId={updatingId}
            />
          ))}
        </div>
      </div>

      {selectedFilho && (
        <FilhoDetailModal
          filho={selectedFilho}
          onClose={() => setSelectedFilho(null)}
          onAdvance={() => handleAdvance(selectedFilho)}
          onCancel={() => handleCancel(selectedFilho)}
          onPrint={() => handlePrint(selectedFilho)}
          updating={updatingId === selectedFilho.id}
        />
      )}

      {printingFilho && (
        <PrintableTicket
          filho={printingFilho}
          produtorName={produtor?.name ?? ''}
        />
      )}
    </>
  )
}
