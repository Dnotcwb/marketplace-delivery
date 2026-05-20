import { firestore } from '@marketplace/shared-firebase'
import type { Address } from '@marketplace/shared-types'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

function col(uid: string) {
  return collection(firestore, 'users', uid, 'addresses')
}

export async function listAddresses(uid: string): Promise<Address[]> {
  const q = query(col(uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Address)
}

export async function createAddress(
  uid: string,
  data: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const ref = await addDoc(col(uid), {
    ...data,
    userId: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  // Se for padrão, remove o padrão dos outros
  if (data.isDefault) {
    await clearOtherDefaults(uid, ref.id)
  }
  return ref.id
}

export async function updateAddress(
  uid: string,
  addressId: string,
  data: Partial<Omit<Address, 'id' | 'userId' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(doc(col(uid), addressId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
  if (data.isDefault) {
    await clearOtherDefaults(uid, addressId)
  }
}

export async function deleteAddress(uid: string, addressId: string): Promise<void> {
  await deleteDoc(doc(col(uid), addressId))
}

async function clearOtherDefaults(uid: string, keepId: string) {
  const snap = await getDocs(col(uid))
  const promises = snap.docs
    .filter((d) => d.id !== keepId && d.data()['isDefault'])
    .map((d) => updateDoc(d.ref, { isDefault: false }))
  await Promise.all(promises)
}
