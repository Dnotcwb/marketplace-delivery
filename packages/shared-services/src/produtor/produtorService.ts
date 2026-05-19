import { firestore } from '@marketplace/shared-firebase'
import type { Produtor, ProdutorStatus } from '@marketplace/shared-types'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

const COL = 'produtores'

// ──────────────────────────────────────────────────────
//  Leitura
// ──────────────────────────────────────────────────────

export async function getProdutorById(id: string): Promise<Produtor | null> {
  const snap = await getDoc(doc(firestore, COL, id))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Produtor) : null
}

export async function getProdutorBySlug(slug: string): Promise<Produtor | null> {
  const q = query(collection(firestore, COL), where('slug', '==', slug))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]!
  return { id: d.id, ...d.data() } as Produtor
}

/** Retorna todos os produtores (apenas admin). */
export async function listAllProdutores(): Promise<Produtor[]> {
  const q = query(collection(firestore, COL), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor)
}

/** Listener em tempo real para todos os produtores (apenas admin). */
export function subscribeToAllProdutores(
  callback: (produtores: Produtor[]) => void,
): Unsubscribe {
  const q = query(collection(firestore, COL), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor))
  })
}

/** Listener em tempo real só do count de produtores pendentes (para badge do sidebar). */
export function subscribeToPendingCount(
  callback: (count: number) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('status', '==', 'pending' satisfies ProdutorStatus),
  )
  return onSnapshot(q, (snap) => callback(snap.size))
}

/** Retorna produtores aprovados (para o consumidor). */
export async function listProdutoresAprovados(): Promise<Produtor[]> {
  const q = query(
    collection(firestore, COL),
    where('status', '==', 'approved' satisfies ProdutorStatus),
    orderBy('name', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor)
}

/** Retorna todos os produtores de um dono (para o app produtor). */
export async function listProdutoresByOwner(ownerUid: string): Promise<Produtor[]> {
  const q = query(
    collection(firestore, COL),
    where('ownerUid', '==', ownerUid),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor)
}

// ──────────────────────────────────────────────────────
//  Listener real-time
// ──────────────────────────────────────────────────────

export function subscribeToProdutorById(
  id: string,
  callback: (produtor: Produtor | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firestore, COL, id), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Produtor) : null)
  })
}

// ──────────────────────────────────────────────────────
//  Escrita
// ──────────────────────────────────────────────────────

/** Cria o perfil do produtor. O `id` deve ser gerado pelo chamador (ou usar doc().id). */
export async function createProdutor(
  id: string,
  data: Omit<Produtor, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  await setDoc(doc(firestore, COL, id), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

/** Atualiza campos específicos do produtor. */
export async function updateProdutor(
  id: string,
  data: Partial<Omit<Produtor, 'id' | 'createdAt' | 'ownerUid'>>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

/** Alterna o status "aceitando pedidos" do produtor. */
export async function toggleProdutorOpen(id: string, isOpen: boolean): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    isOpen,
    updatedAt: serverTimestamp(),
  })
}

// ──────────────────────────────────────────────────────
//  Aprovação (backoffice / Cloud Functions)
// ──────────────────────────────────────────────────────

export async function setProdutorStatus(
  id: string,
  status: ProdutorStatus,
  extra?: { approvedBy?: string; rejectionReason?: string },
): Promise<void> {
  const now = serverTimestamp()
  await updateDoc(doc(firestore, COL, id), {
    status,
    updatedAt: now,
    ...(status === 'approved' && {
      approvedAt: now,
      approvedBy: extra?.approvedBy ?? null,
    }),
    ...(status === 'rejected' && {
      rejectedAt: now,
      rejectionReason: extra?.rejectionReason ?? null,
    }),
  })
}
