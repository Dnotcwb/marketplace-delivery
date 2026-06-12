import { firestore } from '@marketplace/shared-firebase'
import type { Order, PedidoFilho } from '@marketplace/shared-types'
import {
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  collection,
  updateDoc,
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

/** Listener em todos os pedidos (backoffice). Limitado para não baixar a coleção inteira. */
export function subscribeToAllOrders(
  callback: (orders: Order[]) => void,
  onError?: (err: Error) => void,
  maxCount = 800,
): Unsubscribe {
  const q = query(collection(firestore, COL), orderBy('createdAt', 'desc'), limit(maxCount))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Order)),
    (err) => {
      console.error('subscribeToAllOrders:', err)
      onError?.(err)
    },
  )
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

/** Listener em todos os PedidoFilho (backoffice — painel de repassos). */
export function subscribeToAllPedidosFilhos(
  callback: (filhos: PedidoFilho[]) => void,
  maxCount = 1000,
): Unsubscribe {
  const q = query(
    collection(firestore, FILHOS_COL),
    orderBy('createdAt', 'desc'),
    limit(maxCount),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PedidoFilho))
  })
}

/** Busca um PedidoFilho por ID. */
export async function getPedidoFilhoById(filhoId: string): Promise<PedidoFilho | null> {
  const snap = await getDoc(doc(firestore, FILHOS_COL, filhoId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as PedidoFilho
}

/** Marca um PedidoFilho como repasse pago (backoffice). */
export async function marcarRepassePago(filhoId: string): Promise<void> {
  await updateDoc(doc(firestore, FILHOS_COL, filhoId), {
    repassePago: true,
    repassePagoAt: serverTimestamp(),
  })
}

/** Marca todos os PedidoFilhos de um produtor como repasse pago. */
export async function marcarTodosRepassesPagos(filhoIds: string[]): Promise<void> {
  await Promise.all(filhoIds.map((id) => marcarRepassePago(id)))
}
