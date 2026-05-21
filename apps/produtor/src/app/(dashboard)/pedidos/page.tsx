'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS, PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import {
  arrayUnion,
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
  statuses: OrderStatus[]
  headerCls: string
  badgeCls: string
}

const COLUMNS: KanbanColumn[] = [
  {
    key: 'novos',
    label: 'Novos pedidos',
    statuses: ['pending', 'confirmed'],
    headerCls: 'bg-amber-50 border-amber-200',
    badgeCls: 'bg-amber-500',
  },
  {
    key: 'preparo',
    label: 'Em preparo',
    statuses: ['accepted', 'preparing'],
    headerCls: 'bg-purple-50 border-purple-200',
    badgeCls: 'bg-purple-500',
  },
  {
    key: 'prontos',
    label: 'Prontos',
    statuses: ['ready'],
    headerCls: 'bg-indigo-50 border-indigo-200',
    badgeCls: 'bg-indigo-500',
  },
  {
    key: 'entrega',
    label: 'Em entrega',
    statuses: ['on_delivery'],
    headerCls: 'bg-orange-50 border-orange-200',
    badgeCls: 'bg-orange-500',
  },
]

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending:     'confirmed',
  confirmed:   'accepted',
  accepted:    'preparing',
  preparing:   'ready',
  ready:       'on_delivery',
  on_delivery: 'delivered',
}

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  pending:     'Confirmar',
  confirmed:   'Aceitar',
  accepted:    'Iniciar preparo',
  preparing:   'Pronto',
  ready:       'Saiu p/ entrega',
  on_delivery: 'Entregue',
}

const TIMESTAMP_FIELD: Partial<Record<OrderStatus, string>> = {
  confirmed:   'confirmedAt',
  preparing:   'preparingAt',
  ready:       'readyAt',
  on_delivery: 'onDeliveryAt',
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

function PrintableTicket({ order, produtorName }: { order: Order; produtorName: string }) {
  return (
    <div
      id="comanda-print"
      className="hidden print:block fixed inset-0 bg-white z-[9999] p-4"
      style={{ fontFamily: 'monospace', fontSize: '13px', lineHeight: '1.4' }}
    >
      <div style={{ maxWidth: '72mm', margin: '0 auto' }}>
        {/* Cabeçalho */}
        <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{produtorName}</p>
        <p style={{ textAlign: 'center' }}>COMANDA DE PEDIDO</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        <p><strong>Pedido:</strong> #{order.id.slice(0, 8).toUpperCase()}</p>
        <p><strong>Data:</strong> {fullDate(order.createdAt)}</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        {/* Cliente */}
        <p><strong>Cliente:</strong> {order.customerName || '—'}</p>
        {order.customerPhone && <p><strong>Tel:</strong> {order.customerPhone}</p>}
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        {/* Endereço */}
        <p><strong>Entrega:</strong></p>
        <p>{order.deliveryAddress.recipientName}</p>
        <p>{order.deliveryAddress.street}, {order.deliveryAddress.number}
          {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ''}
        </p>
        <p>{order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/{order.deliveryAddress.state}</p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        {/* Itens */}
        <p><strong>ITENS</strong></p>
        {order.items.map((item, i) => (
          <div key={i}>
            <p>{item.quantity}{PRODUCT_UNIT_LABELS[item.unit]} {item.productName}</p>
            {item.notes && <p style={{ paddingLeft: '12px' }}>* {item.notes}</p>}
            <p style={{ textAlign: 'right' }}>{formatCurrency(item.priceInCents * item.quantity)}</p>
          </div>
        ))}
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        {/* Totais */}
        <p>Subtotal: {formatCurrency(order.subtotalInCents)}</p>
        <p>Entrega: {order.deliveryFeeInCents === 0 ? 'Grátis' : formatCurrency(order.deliveryFeeInCents)}</p>
        {order.discountInCents > 0 && (
          <p>Desconto: -{formatCurrency(order.discountInCents)}</p>
        )}
        <p style={{ fontWeight: 'bold', fontSize: '15px' }}>
          TOTAL: {formatCurrency(order.totalInCents)}
        </p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        {/* Pagamento */}
        <p><strong>Pagamento:</strong> {order.payment?.method === 'pix' ? 'PIX' : 'Cartão de crédito'}</p>
        <p>
          <strong>Status:</strong>{' '}
          {order.payment?.status === 'approved' ? 'Aprovado ✓' : 'Pendente'}
        </p>
        <p style={{ textAlign: 'center' }}>{'─'.repeat(36)}</p>

        <p style={{ textAlign: 'center' }}>Tempo estimado: {order.estimatedDeliveryTimeMin}–{order.estimatedDeliveryTimeMax} min</p>
        <p style={{ textAlign: 'center', marginTop: '8px' }}>Obrigado! 🌿</p>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Modal de detalhes do pedido
// ──────────────────────────────────────────────────────

function OrderDetailModal({
  order,
  onClose,
  onAdvance,
  onCancel,
  onPrint,
  updating,
}: {
  order: Order
  onClose: () => void
  onAdvance: () => void
  onCancel: () => void
  onPrint: () => void
  updating: boolean
}) {
  const canAdvance = !!NEXT_STATUS[order.status]
  const canCancel = ['pending', 'confirmed', 'accepted'].includes(order.status)
  const isTerminal = ['delivered', 'cancelled', 'refunded'].includes(order.status)

  return (
    <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho do modal */}
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-5 py-4">
          <div>
            <p className="font-bold text-neutral-900 font-mono">#{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-neutral-400">{fullDate(order.createdAt)}</p>
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
          {/* Cliente */}
          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Cliente</p>
            <p className="font-semibold text-neutral-900">{order.customerName || '—'}</p>
            {order.customerPhone && <p className="text-sm text-neutral-500">{order.customerPhone}</p>}
          </div>

          {/* Itens */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Itens</p>
            <ul className="space-y-2">
              {order.items.map((item, i) => (
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
            <p className="font-semibold text-neutral-900">{order.deliveryAddress.recipientName}</p>
            <p className="text-sm text-neutral-500">
              {order.deliveryAddress.street}, {order.deliveryAddress.number}
              {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ''}
            </p>
            <p className="text-sm text-neutral-500">
              {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/{order.deliveryAddress.state}
            </p>
          </div>

          {/* Valores */}
          <div className="space-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50 p-3.5 text-sm">
            <div className="flex justify-between text-neutral-500"><span>Subtotal</span><span>{formatCurrency(order.subtotalInCents)}</span></div>
            <div className="flex justify-between text-neutral-500">
              <span>Entrega</span>
              <span>{order.deliveryFeeInCents === 0 ? 'Grátis' : formatCurrency(order.deliveryFeeInCents)}</span>
            </div>
            {order.discountInCents > 0 && (
              <div className="flex justify-between text-emerald-600"><span>Desconto</span><span>−{formatCurrency(order.discountInCents)}</span></div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-1.5 font-bold text-neutral-900">
              <span>Total</span><span>{formatCurrency(order.totalInCents)}</span>
            </div>
          </div>

          {/* Pagamento */}
          <p className="text-xs text-neutral-400">
            {order.payment?.method === 'pix' ? 'PIX' : 'Cartão'} ·{' '}
            {order.payment?.status === 'approved' ? '✓ Aprovado' : '⏳ Pendente'}
          </p>

          {/* Ações */}
          {!isTerminal && (
            <div className="flex gap-2 pt-1">
              {canAdvance && (
                <button
                  onClick={onAdvance}
                  disabled={updating}
                  className="flex-1 rounded-xl bg-brand-500 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {updating ? '…' : ACTION_LABEL[order.status]}
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
//  Card de pedido no Kanban
// ──────────────────────────────────────────────────────

function KanbanCard({
  order,
  onSelect,
  onAdvance,
  updating,
  isNew,
}: {
  order: Order
  onSelect: () => void
  onAdvance: (e: React.MouseEvent) => void
  updating: boolean
  isNew: boolean
}) {
  const canAdvance = !!NEXT_STATUS[order.status]

  return (
    <div
      className={[
        'rounded-xl border bg-white shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5',
        isNew ? 'border-amber-400 ring-2 ring-amber-200' : 'border-neutral-200',
      ].join(' ')}
      onClick={onSelect}
    >
      <div className="p-3.5">
        {/* ID + tempo */}
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-xs font-bold text-neutral-700">
            #{order.id.slice(0, 8).toUpperCase()}
          </span>
          <span className="text-xs text-neutral-400">{timeAgo(order.createdAt)}</span>
        </div>

        {/* Cliente */}
        <p className="truncate text-sm font-semibold text-neutral-900">{order.customerName || 'Cliente'}</p>

        {/* Itens resumo */}
        <p className="mt-0.5 truncate text-xs text-neutral-500">
          {order.items.length === 1
            ? `${order.items[0]!.quantity} ${PRODUCT_UNIT_LABELS[order.items[0]!.unit]} ${order.items[0]!.productName}`
            : `${order.items.length} itens · ${order.items[0]!.productName}…`}
        </p>

        {/* Total + botão de ação */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-bold text-neutral-900">{formatCurrency(order.totalInCents)}</span>
          {canAdvance && (
            <button
              onClick={onAdvance}
              disabled={updating}
              className="rounded-lg bg-brand-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {updating ? '…' : ACTION_LABEL[order.status]}
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
  orders,
  newOrderIds,
  onSelect,
  onAdvance,
  updatingId,
}: {
  column: KanbanColumn
  orders: Order[]
  newOrderIds: Set<string>
  onSelect: (o: Order) => void
  onAdvance: (o: Order) => void
  updatingId: string | null
}) {
  return (
    <div className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-100 overflow-hidden">
      {/* Header da coluna */}
      <div className={['flex items-center gap-2 border-b px-3 py-2.5', column.headerCls].join(' ')}>
        <span className="text-sm font-bold text-neutral-800">{column.label}</span>
        <span className={['ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white', column.badgeCls].join(' ')}>
          {orders.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: '120px', maxHeight: '65vh' }}>
        {orders.length === 0 ? (
          <div className="flex h-20 items-center justify-center text-xs text-neutral-400">
            Nenhum pedido
          </div>
        ) : (
          orders.map((order) => (
            <KanbanCard
              key={order.id}
              order={order}
              isNew={newOrderIds.has(order.id)}
              onSelect={() => onSelect(order)}
              onAdvance={(e) => { e.stopPropagation(); onAdvance(order) }}
              updating={updatingId === order.id}
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
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(new Set())
  const [audioUnlocked, setAudioUnlocked] = useState(false)

  const isInitialRef = useRef(true)

  // Desbloqueia audio na primeira interação do usuário
  useEffect(() => {
    function unlock() {
      setAudioUnlocked(true)
      getAudioCtx() // cria o contexto antecipadamente
      document.removeEventListener('click', unlock)
    }
    document.addEventListener('click', unlock)
    return () => document.removeEventListener('click', unlock)
  }, [])

  // Sincroniza selectedOrder com a versão mais recente dos orders
  useEffect(() => {
    if (!selectedOrder) return
    const updated = orders.find((o) => o.id === selectedOrder.id)
    if (updated) setSelectedOrder(updated)
  }, [orders]) // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger de impressão
  useEffect(() => {
    if (!printingOrder) return
    const timer = setTimeout(() => {
      window.print()
      const clear = () => { setPrintingOrder(null); window.removeEventListener('afterprint', clear) }
      window.addEventListener('afterprint', clear)
      // Fallback caso afterprint não dispare
      setTimeout(() => { setPrintingOrder(null); window.removeEventListener('afterprint', clear) }, 8000)
    }, 150)
    return () => clearTimeout(timer)
  }, [printingOrder])

  // Snapshot dos pedidos
  useEffect(() => {
    if (prodLoading || !produtor?.id) {
      if (!prodLoading) setLoading(false)
      return
    }

    const q = query(
      collection(firestore, 'orders'),
      where('produtorId', '==', produtor.id),
    )

    const unsub = onSnapshot(
      q,
      (snap) => {
        const isInitial = isInitialRef.current
        isInitialRef.current = false

        // Detecta pedidos novos (não no carregamento inicial)
        if (!isInitial) {
          const added = snap
            .docChanges()
            .filter(
              (c) =>
                c.type === 'added' &&
                ['pending', 'confirmed'].includes(
                  (c.doc as QueryDocumentSnapshot).data()['status'] as string,
                ),
            )
          if (added.length > 0) {
            if (audioUnlocked) playNewOrderAlert()
            const newIds = new Set(added.map((c) => c.doc.id))
            setNewOrderIds((prev) => new Set([...prev, ...newIds]))
            // Remove highlight após 10s
            setTimeout(() => {
              setNewOrderIds((prev) => {
                const next = new Set(prev)
                newIds.forEach((id) => next.delete(id))
                return next
              })
            }, 10000)
          }
        }

        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Order)
          .sort((a, b) => {
            const aT = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0
            const bT = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0
            return bT - aT
          })

        setOrders(list)
        setLoading(false)
      },
      (err) => {
        console.error('pedidos produtor error:', err.code, err.message)
        setLoading(false)
      },
    )

    return unsub
  }, [prodLoading, produtor, audioUnlocked])

  // ── Handlers ──────────────────────────────────────

  async function handleAdvance(order: Order) {
    const nextStatus = NEXT_STATUS[order.status]
    if (!nextStatus) return
    setUpdatingId(order.id)
    try {
      const tsField = TIMESTAMP_FIELD[nextStatus]
      const update: Record<string, unknown> = {
        status: nextStatus,
        statusHistory: arrayUnion({ status: nextStatus, timestamp: Timestamp.now() }),
      }
      if (tsField) update[tsField] = serverTimestamp()
      await updateDoc(doc(firestore, 'orders', order.id), update)
    } catch (err) {
      console.error('Erro ao avançar status:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleCancel(order: Order) {
    if (!window.confirm(`Cancelar pedido #${order.id.slice(0, 8).toUpperCase()}?`)) return
    setUpdatingId(order.id)
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: 'cancelled',
        statusHistory: arrayUnion({ status: 'cancelled', timestamp: Timestamp.now() }),
      })
      if (selectedOrder?.id === order.id) setSelectedOrder(null)
    } catch (err) {
      console.error('Erro ao cancelar:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  function handlePrint(order: Order) {
    setSelectedOrder(null)
    setTimeout(() => setPrintingOrder(order), 50)
  }

  // ── Render ────────────────────────────────────────

  if (prodLoading || loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const activeOrders = orders.filter((o) =>
    ['pending', 'confirmed', 'accepted', 'preparing', 'ready', 'on_delivery'].includes(o.status),
  )

  return (
    <>
      {/* ── Conteúdo principal (oculto na impressão) ── */}
      <div className="print:hidden flex flex-col gap-4 h-full">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">Pedidos</h1>
          {activeOrders.length > 0 && (
            <span className="rounded-full bg-brand-500 px-2.5 py-0.5 text-xs font-bold text-white">
              {activeOrders.length} ativo{activeOrders.length !== 1 ? 's' : ''}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!audioUnlocked && (
              <span className="hidden sm:inline-block rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-700">
                Clique para ativar alertas sonoros
              </span>
            )}
            <Link
              href="/pedidos/historico"
              className="text-sm font-medium text-neutral-500 hover:text-brand-600 whitespace-nowrap"
            >
              Ver histórico →
            </Link>
          </div>
        </div>

        {/* Kanban */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1 min-h-0">
          {COLUMNS.map((col) => (
            <KanbanColumnView
              key={col.key}
              column={col}
              orders={orders.filter((o) => col.statuses.includes(o.status))}
              newOrderIds={newOrderIds}
              onSelect={setSelectedOrder}
              onAdvance={handleAdvance}
              updatingId={updatingId}
            />
          ))}
        </div>
      </div>

      {/* ── Modal de detalhes ── */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onAdvance={() => handleAdvance(selectedOrder)}
          onCancel={() => handleCancel(selectedOrder)}
          onPrint={() => handlePrint(selectedOrder)}
          updating={updatingId === selectedOrder.id}
        />
      )}

      {/* ── Comanda (só na impressão) ── */}
      {printingOrder && (
        <PrintableTicket
          order={printingOrder}
          produtorName={produtor?.name ?? ''}
        />
      )}
    </>
  )
}
