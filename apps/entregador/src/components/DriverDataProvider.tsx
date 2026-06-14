'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import type { DeliveryDriver, Order } from '@marketplace/shared-types'
import { doc, onSnapshot } from 'firebase/firestore'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { subscribeToDriverOrders } from '@/lib/orderSubscriptions'

interface DriverDataValue {
  /** Documento do entregador (isOnline, ratingAvg, etc.) em tempo real */
  driver: DeliveryDriver | null
  /** Pedidos do próprio entregador (aceitos/entregues) */
  driverOrders: Order[]
  /** true até os pedidos do entregador carregarem pela primeira vez */
  ordersLoading: boolean
  /** Nota agregada (média/total) ou null se ainda sem avaliações */
  rating: { avg: number; count: number } | null
}

const DriverDataContext = createContext<DriverDataValue | null>(null)

/**
 * Mantém as assinaturas do entregador (perfil + pedidos próprios) vivas no
 * layout. Dashboard, Histórico e Ganhos passam a reaproveitar os mesmos dados,
 * sem re-assinar a cada troca de aba. `subscribeToReadyOrders` (entregas
 * disponíveis) fica local ao Dashboard, pois só ele usa.
 */
export function DriverDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [driver, setDriver] = useState<DeliveryDriver | null>(null)
  const [driverOrders, setDriverOrders] = useState<Order[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    const unsubDoc = onSnapshot(doc(firestore, 'deliveryDrivers', user.uid), (snap) => {
      setDriver(snap.exists() ? (snap.data() as DeliveryDriver) : null)
    })
    const unsubOrders = subscribeToDriverOrders(
      user.uid,
      (list) => {
        setDriverOrders(list)
        setOrdersLoaded(true)
      },
      () => setOrdersLoaded(true),
    )
    return () => {
      unsubDoc()
      unsubOrders()
    }
  }, [user?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  const rating = useMemo(() => {
    const count = driver?.ratingCount ?? 0
    const avg = driver?.ratingAvg
    return count > 0 && typeof avg === 'number' ? { avg, count } : null
  }, [driver?.ratingAvg, driver?.ratingCount])

  const value = useMemo<DriverDataValue>(
    () => ({ driver, driverOrders, ordersLoading: !ordersLoaded, rating }),
    [driver, driverOrders, ordersLoaded, rating],
  )

  return <DriverDataContext.Provider value={value}>{children}</DriverDataContext.Provider>
}

export function useDriverData(): DriverDataValue {
  const ctx = useContext(DriverDataContext)
  if (!ctx) throw new Error('useDriverData deve ser usado dentro de <DriverDataProvider>')
  return ctx
}
