import { firestore } from '@marketplace/shared-firebase'
import type { Horta } from '@marketplace/shared-types'
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore'

const COL = 'hortas'

export function subscribeToHortas(
  callback: (hortas: Horta[]) => void,
): Unsubscribe {
  const q = query(collection(firestore, COL), orderBy('name', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Horta))
  })
}

export function subscribeToHortaById(
  id: string,
  callback: (horta: Horta | null) => void,
): Unsubscribe {
  return onSnapshot(doc(firestore, COL, id), (snap) => {
    if (!snap.exists()) callback(null)
    else callback({ id: snap.id, ...snap.data() } as Horta)
  })
}

export async function listHortasAtivas(): Promise<Horta[]> {
  const q = query(collection(firestore, COL), where('status', '==', 'active'))
  const snap = await getDocs(q)
  const hortas = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Horta)
  return hortas.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

export async function getHortaById(id: string): Promise<Horta | null> {
  const snap = await getDoc(doc(firestore, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Horta
}

export async function getHortaBySlug(slug: string): Promise<Horta | null> {
  const q = query(collection(firestore, COL), where('slug', '==', slug))
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]!
  return { id: d.id, ...d.data() } as Horta
}

export async function createHorta(
  data: Omit<Horta, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateHorta(
  id: string,
  data: Partial<Omit<Horta, 'id' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteHorta(id: string): Promise<void> {
  await deleteDoc(doc(firestore, COL, id))
}

/** Remove o vínculo de responsável de uma horta sem deletar o documento. */
export async function removeHortaOwner(id: string): Promise<void> {
  await updateDoc(doc(firestore, COL, id), {
    ownerUid: deleteField(),
    ownerEmail: deleteField(),
    ownerName: deleteField(),
    updatedAt: serverTimestamp(),
  })
}
