'use client'

import { firestore } from '@marketplace/shared-firebase'
import {
  subscribeToMyOrderDriverReview,
  subscribeToMyOrderReview,
  submitDriverReview,
  submitReview,
  useAuth,
} from '@marketplace/shared-services'
import type { DriverReview, Order, OrderStatus, Review, ReviewRating } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS, PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { arrayUnion, doc, getDoc, onSnapshot, Timestamp, updateDoc } from 'firebase/firestore'
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

function formatTimeAgo(ts: Timestamp): string {
  const diffSec = Math.floor((Date.now() - ts.toDate().getTime()) / 1000)
  if (diffSec < 60) return `há ${diffSec}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `há ${diffMin} min`
  return `há ${Math.floor(diffMin / 60)}h`
}

export default function PedidoPage() {
  const params = useParams()
  const orderId = typeof params.orderId === 'string' ? params.orderId : ''
  const { user, loading: authLoading } = useAuth()

  const [order, setOrder] = useState<Order | null | undefined>(undefined)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const [myReview, setMyReview] = useState<Review | null | undefined>(undefined)
  const [reviewRating, setReviewRating] = useState<ReviewRating | 0>(0)
  const [reviewComment, setReviewComment] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState(false)

  const [myDriverReview, setMyDriverReview] = useState<DriverReview | null | undefined>(undefined)
  const [driverReviewRating, setDriverReviewRating] = useState<ReviewRating | 0>(0)
  const [driverReviewComment, setDriverReviewComment] = useState('')
  const [submittingDriverReview, setSubmittingDriverReview] = useState(false)
  const [driverReviewError, setDriverReviewError] = useState<string | null>(null)
  const [driverReviewDone, setDriverReviewDone] = useState(false)
  const [driverName, setDriverName] = useState<string>('Entregador')

  useEffect(() => {
    if (!orderId || !user) return
    const unsub = subscribeToMyOrderReview(orderId, user.uid, (r) => setMyReview(r))
    return unsub
  }, [orderId, user])

  useEffect(() => {
    if (!orderId || !user) return
    const unsub = subscribeToMyOrderDriverReview(orderId, user.uid, (r) => setMyDriverReview(r))
    return unsub
  }, [orderId, user])

  useEffect(() => {
    const driverId = order?.deliveryDriverId
    if (!driverId) return
    getDoc(doc(firestore, 'deliveryDrivers', driverId)).then((snap) => {
      if (snap.exists()) {
        setDriverName((snap.data()?.['displayName'] as string | undefined) ?? 'Entregador')
      }
    })
  }, [order?.deliveryDriverId])

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

  const canCancel = order !== null && order !== undefined
    && ['pending', 'confirmed'].includes(order.status)

  async function handleCancel() {
    if (!order) return
    setCancelling(true)
    setCancelError(null)
    try {
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: 'cancelled',
        statusHistory: arrayUnion({ status: 'cancelled', timestamp: Timestamp.now() }),
      })
      setShowCancelModal(false)
    } catch (err) {
      console.error('cancel error:', err)
      setCancelError('Não foi possível cancelar. Tente novamente ou entre em contato com a horta.')
    } finally {
      setCancelling(false)
    }
  }

  async function handleSubmitReview() {
    if (!order || !user || reviewRating === 0) return
    setSubmittingReview(true)
    setReviewError(null)
    try {
      await submitReview({
        authorUid: user.uid,
        authorName: user.displayName ?? 'Anônimo',
        produtorId: order.produtorId,
        produtorName: order.produtorName,
        orderId: order.id,
        rating: reviewRating as ReviewRating,
        comment: reviewComment.trim() || undefined,
      })
      setReviewDone(true)
    } catch {
      setReviewError('Não foi possível enviar a avaliação. Tente novamente.')
    } finally {
      setSubmittingReview(false)
    }
  }

  async function handleSubmitDriverReview() {
    if (!order || !user || driverReviewRating === 0 || !order.deliveryDriverId) return
    setSubmittingDriverReview(true)
    setDriverReviewError(null)
    try {
      await submitDriverReview({
        authorUid: user.uid,
        authorName: user.displayName ?? 'Anônimo',
        driverUid: order.deliveryDriverId,
        driverName,
        orderId: order.id,
        rating: driverReviewRating as ReviewRating,
        comment: driverReviewComment.trim() || undefined,
      })
      setDriverReviewDone(true)
    } catch {
      setDriverReviewError('Não foi possível enviar a avaliação. Tente novamente.')
    } finally {
      setSubmittingDriverReview(false)
    }
  }

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

      {/* Modal de confirmação de cancelamento */}
      {showCancelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => !cancelling && setShowCancelModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mb-1 text-lg font-bold text-neutral-900">Cancelar pedido?</h2>
            <p className="mb-1 text-sm text-neutral-500">
              Tem certeza que deseja cancelar o pedido{' '}
              <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>?
            </p>
            <p className="mb-5 text-xs text-neutral-400">
              Esta ação não pode ser desfeita. Se o pagamento foi confirmado, entre em contato com a horta para o reembolso.
            </p>
            {cancelError && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{cancelError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 rounded-xl border border-neutral-300 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                Manter pedido
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Cancelando…' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Rastreamento em tempo real — visível durante a entrega */}
      {order.status === 'on_delivery' && (
        <div className="mb-6 overflow-hidden rounded-2xl border-2 border-brand-300 bg-brand-50">
          {/* Banner animado */}
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-50" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-xl">
                🛵
              </span>
            </span>
            <div className="flex-1">
              <p className="font-bold text-brand-800">Entregador a caminho!</p>
              <p className="text-sm text-brand-600">
                Previsão: {order.estimatedDeliveryTimeMin}–{order.estimatedDeliveryTimeMax} min
              </p>
            </div>
          </div>

          {/* Localização */}
          <div className="border-t border-brand-200 px-5 py-3">
            {order.driverLocation ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-brand-700">Localização do entregador</p>
                  {order.driverLocationUpdatedAt && (
                    <p className="text-xs text-brand-400">
                      Atualizado {formatTimeAgo(order.driverLocationUpdatedAt)}
                    </p>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${order.driverLocation.lat},${order.driverLocation.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Ver no mapa
                </a>
              </div>
            ) : (
              <p className="text-xs text-brand-500">
                Aguardando localização do entregador…
              </p>
            )}
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
              <span className="min-w-[2.5rem] text-center font-semibold text-neutral-500">
                {item.quantity} {PRODUCT_UNIT_LABELS[item.unit]}
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

      {canCancel && (
        <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
          <p className="mb-3 text-sm text-red-600">
            Você pode cancelar este pedido enquanto ele ainda não foi aceito pela horta.
          </p>
          <button
            onClick={() => setShowCancelModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Cancelar pedido
          </button>
        </div>
      )}

      {/* Avaliação — só aparece após entrega */}
      {order.status === 'delivered' && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-neutral-900">Avalie sua experiência</h2>

          {myReview !== undefined && myReview !== null ? (
            /* Avaliação já enviada — exibição read-only */
            <div>
              <div className="mb-2 flex gap-0.5">
                {([1, 2, 3, 4, 5] as ReviewRating[]).map((s) => (
                  <span key={s} className={s <= myReview.rating ? 'text-xl text-amber-400' : 'text-xl text-neutral-200'}>
                    ★
                  </span>
                ))}
              </div>
              {myReview.comment && (
                <p className="text-sm text-neutral-600">{myReview.comment}</p>
              )}
              <p className="mt-2 text-xs text-neutral-400">Avaliação enviada</p>
            </div>
          ) : reviewDone ? (
            <p className="text-sm font-medium text-emerald-600">Obrigado pela sua avaliação!</p>
          ) : (
            /* Formulário de avaliação */
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">Sua nota para {order.produtorName}</p>
                <div className="flex gap-1">
                  {([1, 2, 3, 4, 5] as ReviewRating[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewRating(s)}
                      className={[
                        'text-3xl transition-colors',
                        s <= reviewRating ? 'text-amber-400' : 'text-neutral-200 hover:text-amber-200',
                      ].join(' ')}
                      aria-label={`${s} estrela${s > 1 ? 's' : ''}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Conte como foi sua experiência (opcional)"
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-0.5 text-right text-xs text-neutral-400">{reviewComment.length}/500</p>
              </div>

              {reviewError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{reviewError}</p>
              )}

              <button
                onClick={handleSubmitReview}
                disabled={reviewRating === 0 || submittingReview}
                className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReview ? 'Enviando…' : 'Enviar avaliação'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Avaliação do entregador — só aparece após entrega e se houve entregador */}
      {order.status === 'delivered' && order.deliveryDriverId && (
        <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-bold text-neutral-900">Avalie o entregador</h2>
          <p className="mb-4 text-xs text-neutral-400">{driverName}</p>

          {myDriverReview !== undefined && myDriverReview !== null ? (
            <div>
              <div className="mb-2 flex gap-0.5">
                {([1, 2, 3, 4, 5] as ReviewRating[]).map((s) => (
                  <span key={s} className={s <= myDriverReview.rating ? 'text-xl text-amber-400' : 'text-xl text-neutral-200'}>
                    ★
                  </span>
                ))}
              </div>
              {myDriverReview.comment && (
                <p className="text-sm text-neutral-600">{myDriverReview.comment}</p>
              )}
              <p className="mt-2 text-xs text-neutral-400">Avaliação enviada</p>
            </div>
          ) : driverReviewDone ? (
            <p className="text-sm font-medium text-emerald-600">Obrigado pela sua avaliação!</p>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-1">
                {([1, 2, 3, 4, 5] as ReviewRating[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDriverReviewRating(s)}
                    className={[
                      'text-3xl transition-colors',
                      s <= driverReviewRating ? 'text-amber-400' : 'text-neutral-200 hover:text-amber-200',
                    ].join(' ')}
                    aria-label={`${s} estrela${s > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>

              <div>
                <textarea
                  value={driverReviewComment}
                  onChange={(e) => setDriverReviewComment(e.target.value)}
                  placeholder="Como foi a entrega? (opcional)"
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <p className="mt-0.5 text-right text-xs text-neutral-400">{driverReviewComment.length}/500</p>
              </div>

              {driverReviewError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{driverReviewError}</p>
              )}

              <button
                onClick={handleSubmitDriverReview}
                disabled={driverReviewRating === 0 || submittingDriverReview}
                className="w-full rounded-xl bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingDriverReview ? 'Enviando…' : 'Enviar avaliação'}
              </button>
            </div>
          )}
        </div>
      )}

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
