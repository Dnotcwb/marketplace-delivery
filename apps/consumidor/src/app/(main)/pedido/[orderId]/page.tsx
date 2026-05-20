'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { doc, onSnapshot } from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const STATUS_SEQUENCE: OrderStatus[] = [
  'pending',
  'confirmed',
  'accepted',
  'preparing',
  'ready',
  'on_delivery',
  'delivered',
]

const STATUS_ICONS: Partial<Record<OrderStatus, string>> = {
  pending: '⏳',
  confirmed: '✅',
  accepted: '👍',
  preparing: '🍳',
  ready: '📦',
  on_delivery: '🛵',
  delivered: '🎉',
  cancelled: '❌',
  refunded: '💸',
}

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  try {
    return ts.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function PedidoPage() {
  const params = useParams()
  const orderId = typeof params.orderId === 'string' ? params.orderId : ''
  const { user, loading: authLoading } = useAuth()

  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!orderId || authLoading) return
    const ref = doc(firestore, 'orders', orderId)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setFirestoreError(null)
        if (!snap.exists()) {
          setOrder(null)
          return
        }
        setOrder({ id: snap.id, ...snap.data() } as Order)
      },
      (err) => {
        console.error('onSnapshot error:', err.code, err.message)
        setFirestoreError(err.code)
        setOrder(null)
      },
    )
    return unsub
  }, [orderId, authLoading])

  if (authLoading || order === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (firestoreError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 text-lg font-bold text-neutral-800">Não foi possível carregar o pedido</p>
        <p className="mb-6 text-sm text-neutral-500">
          {firestoreError === 'permission-denied'
            ? 'Você não tem permissão para ver este pedido. Verifique se está logado com a conta correta.'
            : `Erro: ${firestoreError}`}
        </p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          ← Voltar ao início
        </Link>
      </div>
    )
  }

  if (order === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 text-lg font-bold text-neutral-800">Pedido não encontrado</p>
        <p className="mb-6 text-sm text-neutral-500">
          O pedido <span className="font-mono">{orderId.slice(0, 8).toUpperCase()}</span> não existe ou foi removido.
        </p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          ← Voltar ao início
        </Link>
      </div>
    )
  }

  if (user && order.customerId !== user.uid) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 text-lg font-bold text-neutral-800">Acesso negado</p>
        <p className="mb-6 text-sm text-neutral-500">Este pedido pertence a outra conta.</p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          ← Voltar ao início
        </Link>
      </div>
    )
  }

  const isCancelled = order.status === 'cancelled' || order.status === 'refunded'
  const currentIdx = STATUS_SEQUENCE.indexOf(order.status)
  const isPix = order.payment?.method === 'pix'
  const pixPending = isPix && order.payment?.status === 'pending'

  function handleCopyPix() {
    const code = order?.payment?.pixQrCode
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">
            Pedido #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-neutral-500">{order.produtorName}</p>
        </div>
        <span
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold',
            isCancelled
              ? 'bg-red-100 text-red-700'
              : order.status === 'delivered'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-brand-100 text-brand-700',
          ].join(' ')}
        >
          {STATUS_ICONS[order.status]} {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* PIX pendente */}
      {pixPending && order.payment?.pixQrCode && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
          <p className="mb-3 text-sm font-semibold text-amber-800">
            Aguardando pagamento via PIX
          </p>
          {order.payment.pixQrCodeBase64 && (
            <div className="mb-3 flex justify-center">
              <Image
                src={`data:image/png;base64,${order.payment.pixQrCodeBase64}`}
                alt="QR Code PIX"
                width={180}
                height={180}
                className="rounded-xl"
                unoptimized
              />
            </div>
          )}
          <button
            onClick={handleCopyPix}
            className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
          >
            {copied ? '✓ Copiado!' : 'Copiar código PIX'}
          </button>
        </div>
      )}

      {/* Timeline de status */}
      {!isCancelled && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-neutral-900">Acompanhe seu pedido</h2>
          <div className="space-y-3">
            {STATUS_SEQUENCE.map((status, idx) => {
              const done = currentIdx >= idx
              const active = currentIdx === idx
              return (
                <div key={status} className="flex items-center gap-3">
                  <div
                    className={[
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm',
                      done
                        ? active
                          ? 'bg-brand-500 text-white ring-4 ring-brand-100'
                          : 'bg-brand-500 text-white'
                        : 'bg-neutral-100 text-neutral-400',
                    ].join(' ')}
                  >
                    {done ? (active ? STATUS_ICONS[status] : '✓') : idx + 1}
                  </div>
                  <div className="flex-1">
                    <p
                      className={[
                        'text-sm font-medium',
                        done ? 'text-neutral-900' : 'text-neutral-400',
                      ].join(' ')}
                    >
                      {ORDER_STATUS_LABELS[status]}
                    </p>
                  </div>
                  {done && !active && (
                    <span className="text-xs text-neutral-400">
                      {formatTimestamp(
                        (order as unknown as Record<string, Timestamp>)[`${status}At`],
                      )}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Cancelado */}
      {isCancelled && (
        <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-center">
          <p className="text-sm font-semibold text-red-700">
            Pedido {order.status === 'refunded' ? 'estornado' : 'cancelado'}
          </p>
          <p className="mt-1 text-xs text-red-500">
            {order.status === 'refunded'
              ? 'O valor será devolvido em até 10 dias úteis.'
              : 'Entre em contato com a horta se precisar de ajuda.'}
          </p>
        </div>
      )}

      {/* Itens */}
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold text-neutral-900">Itens</h2>
        <ul className="space-y-2">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="min-w-[1.5rem] text-center font-semibold text-neutral-500">
                {item.quantity}×
              </span>
              <span className="flex-1 text-neutral-700">{item.productName}</span>
              <span className="font-semibold text-neutral-900">
                {formatCurrency(item.priceInCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Endereço e totais */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
            Entrega
          </h2>
          <p className="text-sm font-semibold text-neutral-900">
            {order.deliveryAddress.recipientName}
          </p>
          <p className="text-sm text-neutral-500">
            {order.deliveryAddress.street}, {order.deliveryAddress.number}
            {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ''}
          </p>
          <p className="text-sm text-neutral-500">
            {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/
            {order.deliveryAddress.state}
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">
            Valores
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-neutral-500">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotalInCents)}</span>
            </div>
            <div className="flex justify-between text-neutral-500">
              <span>Entrega</span>
              <span>
                {order.deliveryFeeInCents === 0 ? (
                  <span className="text-emerald-600">Grátis</span>
                ) : (
                  formatCurrency(order.deliveryFeeInCents)
                )}
              </span>
            </div>
            {order.discountInCents > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Desconto</span>
                <span>−{formatCurrency(order.discountInCents)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-100 pt-1 font-bold text-neutral-900">
              <span>Total</span>
              <span>{formatCurrency(order.totalInCents)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
        >
          ← Explorar outras hortas
        </Link>
      </div>
    </div>
  )
}
