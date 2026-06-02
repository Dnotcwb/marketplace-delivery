import { firestore } from '@marketplace/shared-firebase'
import type { Review, ReviewRating } from '@marketplace/shared-types'
import {
  addDoc,
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
  type Unsubscribe,
} from 'firebase/firestore'

const COL = 'reviews'

export function subscribeToReviews(
  produtorId: string,
  callback: (reviews: Review[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('produtorId', '==', produtorId),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))
  })
}

export function subscribeToMyOrderReview(
  orderId: string,
  authorUid: string,
  callback: (review: Review | null) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('orderId', '==', orderId),
    where('authorUid', '==', authorUid),
    limit(1),
  )
  return onSnapshot(q, (snap) => {
    const first = snap.docs[0]
    callback(snap.empty || !first ? null : ({ id: first.id, ...first.data() } as Review))
  })
}

export function subscribeToAllMyOrderReviews(
  orderId: string,
  authorUid: string,
  callback: (reviews: Review[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('orderId', '==', orderId),
    where('authorUid', '==', authorUid),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))
  })
}

export function subscribeToAllReviews(
  callback: (reviews: Review[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    orderBy('createdAt', 'desc'),
    limit(200),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review))
  })
}

export async function submitReview(data: {
  authorUid: string
  authorName: string
  produtorId: string
  produtorName: string
  orderId: string
  rating: ReviewRating
  comment?: string
}): Promise<string> {
  const ref = await addDoc(collection(firestore, COL), {
    ...data,
    comment: data.comment ?? '',
    deleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function listReviews(produtorId: string, limitCount = 20): Promise<Review[]> {
  const q = query(
    collection(firestore, COL),
    where('produtorId', '==', produtorId),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review)
}

export async function deleteReview(reviewId: string): Promise<void> {
  await updateDoc(doc(firestore, COL, reviewId), {
    deleted: true,
    updatedAt: serverTimestamp(),
  })
}
