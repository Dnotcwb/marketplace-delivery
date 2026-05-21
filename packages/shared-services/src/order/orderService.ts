import { firestore } from '@marketplace/shared-firebase'
import type { Order, PedidoFilho } from '@marketplace/shared-types'
import {
  doc,
  onSnapshot,
  orderBy,
  query,
  collection,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

const COL = 'orders'
const FILHOS_COL = 'pedidos_filhos'

/** Listener em tempo real de um pedido específico. */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firestore, COL, orderId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null)
  })
}

/** Listener nos pedidos do usuário logado (cliente). */
export function subscribeToUserOrders(
  uid: string,
  callback: (orders: Order[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('customerId', '==', uid),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order))
  })
}

/** Listener nos pedidos de um produtor (app produtor). */
export function subscribeToProdutorOrders(
  produtorId: string,
  callback: (orders: Order[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('produtorId', '==', produtorId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order))
  })
}

/** Listener em todos os pedidos (backoffice). */
export function subscribeToAllOrders(
  callback: (orders: Order[]) => void,
): Unsubscribe {
  const q = query(collection(firestore, COL), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order))
  })
}

/** Listener nos PedidoFilho de um produtor (app produtor — novo modelo). */
export function subscribeToPedidoFilhos(
  produtorId: string,
  callback: (filhos: PedidoFilho[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, FILHOS_COL),
    where('produtorId', '==', produtorId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PedidoFilho))
  })
}

/** Listener nos PedidoFilho de um pedido pai específico. */
export function subscribeToPedidoFilhosByPai(
  pedidoPaiId: string,
  callback: (filhos: PedidoFilho[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, FILHOS_COL),
    where('pedidoPaiId', '==', pedidoPaiId),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PedidoFilho))
  })
}
