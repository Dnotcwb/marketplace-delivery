import { firestore } from '@marketplace/shared-firebase'
import type { DriverReview, ReviewRating } from '@marketplace/shared-types'
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

const COL = 'driver_reviews'

export function subscribeToDriverReviews(
  driverUid: string,
  callback: (reviews: DriverReview[]) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('driverUid', '==', driverUid),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(20),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DriverReview))
  })
}

export function subscribeToMyOrderDriverReview(
  orderId: string,
  authorUid: string,
  callback: (review: DriverReview | null) => void,
): Unsubscribe {
  const q = query(
    collection(firestore, COL),
    where('orderId', '==', orderId),
    where('authorUid', '==', authorUid),
    limit(1),
  )
  return onSnapshot(q, (snap) => {
    const first = snap.docs[0]
    callback(snap.empty || !first ? null : ({ id: first.id, ...first.data() } as DriverReview))
  })
}

export async function submitDriverReview(data: {
  authorUid: string
  authorName: string
  driverUid: string
  driverName: string
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

export async function listDriverReviews(driverUid: string, limitCount = 20): Promise<DriverReview[]> {
  const q = query(
    collection(firestore, COL),
    where('driverUid', '==', driverUid),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(limitCount),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DriverReview)
}

export async function deleteDriverReview(reviewId: string): Promise<void> {
  await updateDoc(doc(firestore, COL, reviewId), {
    deleted: true,
    updatedAt: serverTimestamp(),
  })
}
