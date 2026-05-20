import { firestore } from '@marketplace/shared-firebase'
import type { Order } from '@marketplace/shared-types'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

const COL = 'orders'

/** Pedidos com status 'ready' em tempo real (filtragem de sem-driver no cliente). */
export function subscribeToReadyOrders(
  callback: (orders: Order[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('status', '==', 'ready'),
    where('deliveryDriverId', '==', null),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (err) => {
      console.error('subscribeToReadyOrders:', err)
      onError?.(err)
    },
  )
}

/** Todos os pedidos de um entregador específico em tempo real. */
export function subscribeToDriverOrders(
  driverUid: string,
  callback: (orders: Order[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('deliveryDriverId', '==', driverUid),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (err) => {
      console.error('subscribeToDriverOrders:', err)
      onError?.(err)
    },
  )
}

/** Pedido específico por ID em tempo real. */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order | null) => void,
): Unsubscribe {
  return onSnapshot(
    doc(firestore, COL, orderId),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null),
    (err) => console.error('subscribeToOrder:', err),
  )
}
