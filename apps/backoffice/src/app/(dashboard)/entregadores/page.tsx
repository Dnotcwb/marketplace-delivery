'use client'

import { firestore, functions } from '@marketplace/shared-firebase'
import type { DeliveryDriver, DriverStatus } from '@marketplace/shared-types'
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useEffect, useState } from 'react'

const setUserRole = httpsCallable<
  { uid: string; role: string },
  { success: boolean }
>(functions, 'setUserRole')

const STATUS_CONFIG: Record<DriverStatus, { label: string; cls: string }> = {
  pending_approval: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-700' },
  approved:         { label: 'Aprovado',             cls: 'bg-emerald-100 text-emerald-700' },
  suspended:        { label: 'Suspenso',             cls: 'bg-red-100 text-red-600' },
  rejected:         { label: 'Rejeitado',            cls: 'bg-neutral-100 text-neutral-500' },
}

const VEHICLE_LABELS: Record<string, string> = {
  moto:      '🏍️ Moto',
  bicicleta: '🚲 Bicicleta',
  carro:     '🚗 Carro',
  van:       '🚐 Van',
}

export default function EntregadoresPage() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(
      collection(firestore, 'deliveryDrivers'),
      orderBy('createdAt', 'desc'),
    )
    return onSnapshot(
      q,
      (snap) => {
        setDrivers(snap.docs.map((d) => ({ ...d.data() } as DeliveryDriver)))
        setLoading(false)
      },
      (err) => { console.error('deliveryDrivers snapshot:', err); setLoading(false) },
    )
  }, [])

  async function handleApprove(driver: DeliveryDriver) {
    setActing(driver.uid)
    setError('')
    try {
      await setUserRole({ uid: driver.uid, role: 'entregador' })
      await updateDoc(doc(firestore, 'deliveryDrivers', driver.uid), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('approve driver:', err)
      setError(`Erro ao aprovar ${driver.displayName}.`)
    } finally {
      setActing(null)
    }
  }

  async function handleSuspend(driver: DeliveryDriver) {
    if (!window.confirm(`Suspender ${driver.displayName}?`)) return
    setActing(driver.uid)
    setError('')
    try {
      await setUserRole({ uid: driver.uid, role: 'cliente' })
      await updateDoc(doc(firestore, 'deliveryDrivers', driver.uid), {
        status: 'suspended',
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('suspend driver:', err)
      setError(`Erro ao suspender ${driver.displayName}.`)
    } finally {
      setActing(null)
    }
  }

  async function handleReject(driver: DeliveryDriver) {
    if (!window.confirm(`Rejeitar cadastro de ${driver.displayName}?`)) return
    setActing(driver.uid)
    setError('')
    try {
      await updateDoc(doc(firestore, 'deliveryDrivers', driver.uid), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('reject driver:', err)
      setError(`Erro ao rejeitar ${driver.displayName}.`)
    } finally {
      setActing(null)
    }
  }

  const pending  = drivers.filter((d) => d.status === 'pending_approval')
  const rest     = drivers.filter((d) => d.status !== 'pending_approval')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Entregadores</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Gerencie cadastros e aprovações de entregadores.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Pendentes */}
      {!loading && pending.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white">
              {pending.length}
            </span>
            Aguardando aprovação
          </h2>
          <ul className="space-y-3">
            {pending.map((driver) => (
              <DriverCard
                key={driver.uid}
                driver={driver}
                acting={acting === driver.uid}
                onApprove={() => handleApprove(driver)}
                onReject={() => handleReject(driver)}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Todos os outros */}
      <section>
        <h2 className="mb-3 text-sm font-bold text-neutral-700">Todos os entregadores</h2>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : drivers.length === 0 ? (
          <div className="rounded-xl border border-neutral-200 bg-white px-5 py-12 text-center">
            <div className="mb-3 text-4xl">🛵</div>
            <p className="text-sm text-neutral-500">Nenhum entregador cadastrado ainda.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-3 text-left">Entregador</th>
                  <th className="px-5 py-3 text-left">Contato</th>
                  <th className="px-5 py-3 text-left">Veículo</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {[...pending, ...rest].map((driver) => {
                  const badge = STATUS_CONFIG[driver.status]
                  return (
                    <tr key={driver.uid} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-neutral-900">{driver.displayName}</p>
                        <p className="text-xs text-neutral-400">{driver.email}</p>
                      </td>
                      <td className="px-5 py-3 text-neutral-600">{driver.phone}</td>
                      <td className="px-5 py-3 text-neutral-600">
                        {VEHICLE_LABELS[driver.vehicleType] ?? driver.vehicleType}
                        {driver.vehiclePlate && (
                          <span className="ml-1 text-xs text-neutral-400">· {driver.vehiclePlate}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {driver.status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApprove(driver)}
                                disabled={acting === driver.uid}
                                className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                              >
                                {acting === driver.uid ? '...' : 'Aprovar'}
                              </button>
                              <button
                                onClick={() => handleReject(driver)}
                                disabled={acting === driver.uid}
                                className="rounded-lg border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                              >
                                Rejeitar
                              </button>
                            </>
                          )}
                          {driver.status === 'approved' && (
                            <button
                              onClick={() => handleSuspend(driver)}
                              disabled={acting === driver.uid}
                              className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {acting === driver.uid ? '...' : 'Suspender'}
                            </button>
                          )}
                          {driver.status === 'suspended' && (
                            <button
                              onClick={() => handleApprove(driver)}
                              disabled={acting === driver.uid}
                              className="rounded-lg bg-emerald-500 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                            >
                              {acting === driver.uid ? '...' : 'Reativar'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function DriverCard({
  driver,
  acting,
  onApprove,
  onReject,
}: {
  driver: DeliveryDriver
  acting: boolean
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <li className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-bold text-neutral-900">{driver.displayName}</p>
          <p className="text-sm text-neutral-600">{driver.email}</p>
          <p className="text-sm text-neutral-600">{driver.phone}</p>
          <p className="mt-1 text-sm text-neutral-500">
            {VEHICLE_LABELS[driver.vehicleType] ?? driver.vehicleType}
            {driver.vehiclePlate && ` · ${driver.vehiclePlate}`}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2">
          <button
            onClick={onApprove}
            disabled={acting}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {acting ? 'Aprovando...' : '✓ Aprovar'}
          </button>
          <button
            onClick={onReject}
            disabled={acting}
            className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
          >
            Rejeitar
          </button>
        </div>
      </div>
    </li>
  )
}
