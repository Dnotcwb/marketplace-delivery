import { firestore } from '@marketplace/shared-firebase'
import type { Category, Product } from '@marketplace/shared-types'
import {
  collection,
  deleteDoc,
  doc,
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

function newId(col: ReturnType<typeof collection>): string {
  return doc(col).id
}

// ──────────────────────────────────────────────────────
//  Paths
// ──────────────────────────────────────────────────────

const categoriesCol = (produtorId: string) =>
  collection(firestore, 'produtores', produtorId, 'categories')

const categoryDoc = (produtorId: string, categoryId: string) =>
  doc(firestore, 'produtores', produtorId, 'categories', categoryId)

const productsCol = (produtorId: string) =>
  collection(firestore, 'produtores', produtorId, 'products')

const productDoc = (produtorId: string, productId: string) =>
  doc(firestore, 'produtores', produtorId, 'products', productId)

// ──────────────────────────────────────────────────────
//  Categorias — leitura
// ──────────────────────────────────────────────────────

export async function listCategories(produtorId: string): Promise<Category[]> {
  const q = query(categoriesCol(produtorId), orderBy('order', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category)
}

export function subscribeToCategories(
  produtorId: string,
  callback: (categories: Category[]) => void,
): Unsubscribe {
  const q = query(categoriesCol(produtorId), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category))
  })
}

// ──────────────────────────────────────────────────────
//  Categorias — escrita
// ──────────────────────────────────────────────────────

export async function createCategory(
  produtorId: string,
  data: Omit<Category, 'id' | 'produtorId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = newId(categoriesCol(produtorId))
  await setDoc(categoryDoc(produtorId, id), {
    ...data,
    produtorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

export async function updateCategory(
  produtorId: string,
  id: string,
  data: Partial<Omit<Category, 'id' | 'produtorId' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(categoryDoc(produtorId, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCategory(produtorId: string, id: string): Promise<void> {
  await deleteDoc(categoryDoc(produtorId, id))
}

// ──────────────────────────────────────────────────────
//  Produtos — leitura
// ──────────────────────────────────────────────────────

export async function listProducts(produtorId: string): Promise<Product[]> {
  const q = query(productsCol(produtorId), orderBy('order', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
}

export async function listProductsByCategory(
  produtorId: string,
  categoryId: string,
): Promise<Product[]> {
  const q = query(
    productsCol(produtorId),
    where('categoryId', '==', categoryId),
    orderBy('order', 'asc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product)
}

export function subscribeToProducts(
  produtorId: string,
  callback: (products: Product[]) => void,
  categoryId?: string,
): Unsubscribe {
  const base = productsCol(produtorId)
  const q = categoryId
    ? query(base, where('categoryId', '==', categoryId), orderBy('order', 'asc'))
    : query(base, orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product))
  })
}

// ──────────────────────────────────────────────────────
//  Produtos — escrita
// ──────────────────────────────────────────────────────

export async function createProduct(
  produtorId: string,
  data: Omit<Product, 'id' | 'produtorId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const id = newId(productsCol(produtorId))
  await setDoc(productDoc(produtorId, id), {
    ...data,
    produtorId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return id
}

export async function updateProduct(
  produtorId: string,
  id: string,
  data: Partial<Omit<Product, 'id' | 'produtorId' | 'createdAt'>>,
): Promise<void> {
  await updateDoc(productDoc(produtorId, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProduct(produtorId: string, id: string): Promise<void> {
  await deleteDoc(productDoc(produtorId, id))
}

export async function toggleProductAvailable(
  produtorId: string,
  id: string,
  available: boolean,
): Promise<void> {
  await updateDoc(productDoc(produtorId, id), {
    available,
    updatedAt: serverTimestamp(),
  })
}

export async function setProductStock(
  produtorId: string,
  id: string,
  stock: number | null,
): Promise<void> {
  await updateDoc(productDoc(produtorId, id), {
    stock: stock ?? null,
    updatedAt: serverTimestamp(),
  })
}
