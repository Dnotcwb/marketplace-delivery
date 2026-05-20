'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { Order, OrderStatus } from '@marketplace/shared-types'
import { ORDER_STATUS_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const STATUS_COLOR: Partial<Record<OrderStatus, string>> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  accepted: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  ready: 'bg-indigo-100 text-indigo-700',
  on_delivery: 'bg-orange-100 text-orange-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-red-100 text-red-700',
}

function formatDate(ts: { toDate: () => Date } | null | undefined): string {
  if (!ts) return ''
  try {
    return ts.toDate().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function PedidosPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [orders, setOrders] = useState<Order[] | null>(null)
  const [firestoreError, setFirestoreError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }

    const q = query(
      collection(firestore, 'orders'),
      where('customerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFirestoreError(null)
        setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order))
      },
      (err) => {
        console.error('pedidos onSnapshot error:', err.code, err.message)
        setFirestoreError(err.code)
        setOrders([])
      },
    )

    return unsub
  }, [authLoading, user, router])

  if (authLoading || orders === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (firestoreError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 text-lg font-bold text-neutral-800">Erro ao carregar pedidos</p>
        <p className="mb-6 text-sm text-neutral-500">Erro: {firestoreError}</p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          ← Voltar ao início
        </Link>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-2 text-5xl">🛒</p>
        <p className="mb-2 text-lg font-bold text-neutral-800">Nenhum pedido ainda</p>
        <p className="mb-6 text-sm text-neutral-500">Seus pedidos aparecerão aqui depois que você finalizar uma compra.</p>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">
          Explorar hortas
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Meus pedidos</h1>

      <ul className="space-y-3">
        {orders.map((order) => (
          <li key={order.id}>
            <Link
              href={`/pedido/${order.id}`}
              className="block rounded-2xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-neutral-900">{order.produtorName}</p>
                  <p className="text-xs text-neutral-400">
                    #{order.id.slice(0, 8).toUpperCase()} · {formatDate(order.createdAt as Parameters<typeof formatDate>[0])}
                  </p>
                </div>
                <span
                  className={[
                    'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    STATUS_COLOR[order.status] ?? 'bg-neutral-100 text-neutral-600',
                  ].join(' ')}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">
                  {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                  {order.items.length > 0 && ` · ${order.items[0]!.productName}${order.items.length > 1 ? ` +${order.items.length - 1}` : ''}`}
                </span>
                <span className="font-bold text-neutral-900">{formatCurrency(order.totalInCents)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
