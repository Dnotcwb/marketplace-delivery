import type { Timestamp } from 'firebase/firestore'

export type ReviewRating = 1 | 2 | 3 | 4 | 5

export interface Review {
  id: string
  authorUid: string
  authorName: string
  produtorId: string
  produtorName: string
  orderId: string
  rating: ReviewRating
  comment?: string
  deleted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface DriverReview {
  id: string
  authorUid: string
  authorName: string
  driverUid: string
  driverName: string
  orderId: string
  rating: ReviewRating
  comment?: string
  deleted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
