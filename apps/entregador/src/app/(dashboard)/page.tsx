'use client'

import { firestore, functions } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { Order } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'
import { subscribeToReadyOrders } from '@/lib/orderSubscriptions'
import { useDriverData } from '@/components/DriverDataProvider'

const acceptDeliveryFn = httpsCallable<{ orderId: string }, { success: boolean }>(
  functions,
  'acceptDelivery',
)

export default function HomePage() {
  const { user } = useAuth()
  const { driver, driverOrders, ordersLoading } = useDriverData()
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [readyLoading, setReadyLoading] = useState(true)
  const [accepting, setAccepting] = useState<string | null>(null)
  const [togglingOnline, setTogglingOnline] = useState(false)
  const [error, setError] = useState('')
  const [permissionError, setPermissionError] = useState(false)
  const [queryError, setQueryError] = useState('')

  const loading = readyLoading || ordersLoading

  // Entregas disponíveis (status 'ready') — exclusivo do dashboard
  useEffect(() => {
    if (!user) return
    return subscribeToReadyOrders(
      (orders) => {
        setReadyOrders(orders)
        setReadyLoading(false)
      },
      (err) => {
        const code = (err as { code?: string }).code
        if (code === 'permission-denied') setPermissionError(true)
        else setQueryError(`Erro ao carregar entregas (${code ?? err.message})`)
        setReadyLoading(false)
      },
    )
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const isOnline = driver?.isOnline ?? false
  const activeDelivery = driverOrders.find((o) => o.status === 'on_delivery')
  const available = readyOrders.filter((o) => !o.deliveryDriverId)

  async function handleToggleOnline() {
    if (!user) return
    setTogglingOnline(true)
    try {
      await updateDoc(doc(firestore, 'deliveryDrivers', user.uid), {
        isOnline: !isOnline,
        updatedAt: serverTimestamp(),
      })
    } catch {
      setError('Não foi possível alterar o status. Tente novamente.')
    } finally {
      setTogglingOnline(false)
    }
  }

  async function handleAccept(orderId: string) {
    setAccepting(orderId)
    setError('')
    try {
      await acceptDeliveryFn({ orderId })
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message ?? 'Erro ao aceitar entrega.'
      setError(msg)
    } finally {
      setAccepting(null)
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      {/* Toggle online/offline */}
      <div
        className={[
          'flex items-center justify-between rounded-xl border px-4 py-3',
          isOnline
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-neutral-200 bg-white',
        ].join(' ')}
      >
        <div>
          <p className={['text-sm font-bold', isOnline ? 'text-emerald-700' : 'text-neutral-600'].join(' ')}>
            {isOnline ? 'Você está online' : 'Você está offline'}
          </p>
          <p className="text-xs text-neutral-400 mt-0.5">
            {isOnline
              ? 'Recebendo novos pedidos e notificações'
              : 'Ative para receber pedidos e notificações'}
          </p>
        </div>
        <button
          onClick={handleToggleOnline}
          disabled={togglingOnline}
          aria-label={isOnline ? 'Ficar offline' : 'Ficar online'}
          className={[
            'relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60',
            isOnline ? 'bg-emerald-500' : 'bg-neutral-300',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200',
              isOnline ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Entrega ativa — sempre visível independente do status online */}
      {activeDelivery && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
            Entrega em andamento
          </h2>
          <a
            href={`/entrega/${activeDelivery.id}`}
            className="block rounded-xl border-2 border-brand-500 bg-brand-50 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-brand-800">{activeDelivery.produtorName}</p>
                <p className="mt-0.5 text-sm text-brand-600">
                  {activeDelivery.deliveryAddress.street}, {activeDelivery.deliveryAddress.number}
                </p>
                <p className="text-sm text-brand-600">
                  {activeDelivery.deliveryAddress.neighborhood} — {activeDelivery.deliveryAddress.city}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-brand-700">{formatCurrency(activeDelivery.deliveryFeeInCents)}</p>
                <p className="text-xs text-brand-500">taxa de entrega</p>
                <span className="mt-1 inline-block text-sm font-medium text-brand-600">Ver detalhes →</span>
              </div>
            </div>
          </a>
        </section>
      )}

      {/* Pedidos disponíveis */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">
            Entregas disponíveis
          </h2>
          {!loading && isOnline && (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold text-neutral-600">
              {available.length}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {!isOnline ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mb-3 text-4xl">😴</div>
            <p className="font-medium text-neutral-700">Você está offline</p>
            <p className="mt-1 text-sm text-neutral-400">
              Ative o botão acima para começar a receber pedidos.
            </p>
          </div>
        ) : queryError ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="font-medium">Erro ao carregar pedidos</p>
            <p className="mt-0.5 text-xs font-mono">{queryError}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-xs underline">
              Recarregar
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : permissionError ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-12 text-center shadow-sm">
            <div className="mb-3 text-4xl">🔒</div>
            <p className="font-medium text-neutral-700">Sem permissão para ver entregas</p>
            <p className="mt-1 text-sm text-neutral-400">
              Seu acesso ainda está sendo ativado. Aguarde alguns instantes e recarregue a página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Recarregar
            </button>
          </div>
        ) : available.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center shadow-sm">
            <div className="mb-3 text-4xl">📭</div>
            <p className="font-medium text-neutral-700">Nenhuma entrega disponível</p>
            <p className="mt-1 text-sm text-neutral-400">
              Aguarde — os pedidos aparecem aqui em tempo real.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {available.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900">{order.produtorName}</p>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      {order.deliveryAddress.street}, {order.deliveryAddress.number}
                      {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ''}
                    </p>
                    <p className="text-sm text-neutral-500">
                      {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-bold text-brand-600">
                      {formatCurrency(order.deliveryFeeInCents)}
                    </p>
                    <p className="text-xs text-neutral-400">taxa</p>
                  </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                    Total: {formatCurrency(order.totalInCents)}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                    {order.estimatedDeliveryTimeMin}–{order.estimatedDeliveryTimeMax} min
                  </span>
                </div>

                {activeDelivery ? (
                  <p className="text-center text-xs text-neutral-400">
                    Finalize a entrega atual antes de aceitar outra.
                  </p>
                ) : (
                  <button
                    onClick={() => handleAccept(order.id)}
                    disabled={accepting === order.id}
                    className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
                  >
                    {accepting === order.id ? 'Aceitando...' : 'Aceitar entrega'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
