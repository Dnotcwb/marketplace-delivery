'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { Order } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { arrayUnion, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { subscribeToOrder } from '@/lib/orderSubscriptions'

export default function EntregaDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    return subscribeToOrder(orderId, (o) => {
      setOrder(o)
      setLoading(false)
    })
  }, [orderId])

  async function handleConfirmDelivered() {
    if (!order || !user) return
    setConfirming(true)
    setError('')
    try {
      const now = Timestamp.now()
      await updateDoc(doc(firestore, 'orders', order.id), {
        status: 'delivered',
        deliveredAt: now,
        statusHistory: arrayUnion({ status: 'delivered', timestamp: now }),
      })
      router.push('/')
    } catch {
      setError('Não foi possível confirmar a entrega. Tente novamente.')
    } finally {
      setConfirming(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">Pedido não encontrado.</p>
        <button onClick={() => router.push('/')} className="mt-4 text-sm text-brand-500 hover:underline">
          Voltar
        </button>
      </div>
    )
  }

  // Only allow the driver assigned to this order
  if (order.deliveryDriverId !== user?.uid) {
    return (
      <div className="text-center py-20">
        <p className="text-neutral-500">Este pedido não está atribuído a você.</p>
        <button onClick={() => router.push('/')} className="mt-4 text-sm text-brand-500 hover:underline">
          Voltar
        </button>
      </div>
    )
  }

  const isDelivered = order.status === 'delivered'

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/')}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-50"
        >
          ← Voltar
        </button>
        <h1 className="text-lg font-bold text-neutral-900">Entrega #{order.id.slice(0, 8)}</h1>
      </div>

      {/* Status atual */}
      <div className={`rounded-xl px-4 py-3 text-center font-semibold ${
        isDelivered
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-brand-50 text-brand-700 border border-brand-200'
      }`}>
        {isDelivered ? '✅ Entrega concluída!' : '🚀 Em rota de entrega'}
      </div>

      {/* Endereço de entrega */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-700">Endereço de entrega</h2>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${order.deliveryAddress.street}, ${order.deliveryAddress.number}, ${order.deliveryAddress.neighborhood}, ${order.deliveryAddress.city} - ${order.deliveryAddress.state}, ${order.deliveryAddress.cep}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Abrir rota
          </a>
        </div>
        <p className="font-medium text-neutral-900">{order.deliveryAddress.recipientName}</p>
        <p className="text-sm text-neutral-600 mt-0.5">
          {order.deliveryAddress.street}, {order.deliveryAddress.number}
          {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ''}
        </p>
        <p className="text-sm text-neutral-600">
          {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/{order.deliveryAddress.state}
        </p>
        <p className="text-sm text-neutral-500">CEP: {order.deliveryAddress.cep}</p>
        {order.deliveryAddress.phone && (
          <a
            href={`tel:${order.deliveryAddress.phone}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
          >
            📞 {order.deliveryAddress.phone}
          </a>
        )}
      </section>

      {/* Produtor (origem da coleta) */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-bold text-neutral-700">Retirar em</h2>
        <p className="font-medium text-neutral-900">{order.produtorName}</p>
      </section>

      {/* Itens do pedido */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-bold text-neutral-700">Itens do pedido</h2>
        </div>
        <ul className="divide-y divide-neutral-100">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-neutral-800">
                {item.quantity} {PRODUCT_UNIT_LABELS[item.unit]} {item.productName}
              </span>
              <span className="text-sm font-medium text-neutral-700">
                {formatCurrency(item.priceInCents * item.quantity)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-neutral-100 px-4 py-3 flex justify-between">
          <span className="text-sm font-semibold text-neutral-700">Total do pedido</span>
          <span className="text-sm font-bold text-neutral-900">{formatCurrency(order.totalInCents)}</span>
        </div>
      </section>

      {/* Taxa do entregador */}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-brand-700">Sua taxa de entrega</span>
        <span className="text-lg font-bold text-brand-700">{formatCurrency(order.deliveryFeeInCents)}</span>
      </div>

      {/* Ação */}
      {!isDelivered && (
        <>
          {error && (
            <p className="text-sm text-red-600 text-center">{error}</p>
          )}
          <button
            onClick={handleConfirmDelivered}
            disabled={confirming}
            className="w-full rounded-xl bg-emerald-500 py-4 text-base font-bold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {confirming ? 'Confirmando...' : '✅ Confirmar entrega realizada'}
          </button>
        </>
      )}
    </div>
  )
}
