import { firestore } from '@marketplace/shared-firebase'
import type { Coupon } from '@marketplace/shared-types'
import { collection, getDocs, limit, query, Timestamp, where } from 'firebase/firestore'

export interface CouponPreview {
  valid: boolean
  code: string
  discountInCents: number
  description: string
  error?: string
}

export async function validateCoupon(
  code: string,
  subtotalInCents: number,
): Promise<CouponPreview> {
  const normalised = code.trim().toUpperCase()
  if (!normalised) return { valid: false, code: normalised, discountInCents: 0, description: '', error: 'Digite um código.' }

  const q = query(
    collection(firestore, 'coupons'),
    where('code', '==', normalised),
    where('active', '==', true),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) {
    return { valid: false, code: normalised, discountInCents: 0, description: '', error: 'Cupom não encontrado.' }
  }

  const coupon = snap.docs[0]!.data() as Coupon
  const now = Timestamp.now().toMillis()

  if (coupon.validFrom.toMillis() > now) {
    return { valid: false, code: normalised, discountInCents: 0, description: '', error: 'Este cupom ainda não está ativo.' }
  }
  if (coupon.validUntil.toMillis() < now) {
    return { valid: false, code: normalised, discountInCents: 0, description: '', error: 'Este cupom expirou.' }
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, code: normalised, discountInCents: 0, description: '', error: 'Este cupom atingiu o limite de usos.' }
  }
  if (coupon.minOrderValueInCents && subtotalInCents < coupon.minOrderValueInCents) {
    const min = (coupon.minOrderValueInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    return { valid: false, code: normalised, discountInCents: 0, description: '', error: `Pedido mínimo de ${min} para este cupom.` }
  }

  let discountInCents: number
  let description: string
  if (coupon.type === 'percentage') {
    discountInCents = Math.round(subtotalInCents * coupon.value / 100)
    if (coupon.maxDiscountInCents) discountInCents = Math.min(discountInCents, coupon.maxDiscountInCents)
    description = `${coupon.value}% de desconto`
  } else {
    discountInCents = Math.min(coupon.value, subtotalInCents)
    description = `Desconto fixo`
  }

  return { valid: true, code: normalised, discountInCents, description }
}
