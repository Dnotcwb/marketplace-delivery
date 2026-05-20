'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Coupon, CouponType } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

// ─── helpers ───────────────────────────────────────────────

function fmtDate(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return '—'
  try {
    return (ts as Timestamp).toDate().toLocaleDateString('pt-BR')
  } catch { return '—' }
}

function isExpired(ts: unknown): boolean {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return false
  try { return (ts as Timestamp).toDate() < new Date() } catch { return false }
}

function toDateInput(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return ''
  try { return (ts as Timestamp).toDate().toISOString().slice(0, 10) } catch { return '' }
}

// ─── form schema ───────────────────────────────────────────

const schema = z
  .object({
    code: z
      .string()
      .min(3, 'Mínimo 3 caracteres')
      .max(20)
      .regex(/^[A-Z0-9_-]+$/, 'Apenas letras maiúsculas, números, _ e -'),
    type: z.enum(['percentage', 'fixed']),
    value: z.coerce.number().positive('Deve ser maior que 0'),
    minOrder: z.string().optional().default(''),
    maxDiscount: z.string().optional().default(''),
    maxUses: z.string().optional().default(''),
    validFrom: z.string().min(1, 'Obrigatório'),
    validUntil: z.string().min(1, 'Obrigatório'),
    active: z.boolean().default(true),
  })
  .refine((d) => d.validUntil >= d.validFrom, {
    message: 'Data final deve ser ≥ data inicial',
    path: ['validUntil'],
  })
  .refine((d) => d.type !== 'percentage' || d.value <= 100, {
    message: 'Percentual máximo é 100',
    path: ['value'],
  })

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

// ─── modal ─────────────────────────────────────────────────

function CouponModal({
  editing,
  onClose,
}: {
  editing: Coupon | null
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: editing
      ? {
          code: editing.code,
          type: editing.type,
          value: editing.type === 'percentage' ? editing.value : editing.value / 100,
          minOrder: editing.minOrderValueInCents ? String(editing.minOrderValueInCents / 100) : '',
          maxDiscount: editing.maxDiscountInCents ? String(editing.maxDiscountInCents / 100) : '',
          maxUses: editing.maxUses != null ? String(editing.maxUses) : '',
          validFrom: toDateInput(editing.validFrom),
          validUntil: toDateInput(editing.validUntil),
          active: editing.active,
        }
      : {
          type: 'percentage',
          active: true,
          validFrom: new Date().toISOString().slice(0, 10),
          validUntil: '',
        },
  })

  const type = watch('type')

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const code = data.code.toUpperCase()
      const valueInStore = data.type === 'percentage' ? data.value : Math.round(data.value * 100)
      const payload: Omit<Coupon, 'createdAt' | 'usedCount'> & { usedCount?: number; createdAt?: unknown; updatedAt?: unknown } = {
        code,
        type: data.type,
        value: valueInStore,
        minOrderValueInCents: data.minOrder ? Math.round(parseFloat(data.minOrder) * 100) : undefined,
        maxDiscountInCents: data.type === 'percentage' && data.maxDiscount ? Math.round(parseFloat(data.maxDiscount) * 100) : undefined,
        produtorId: null,
        maxUses: data.maxUses ? parseInt(data.maxUses, 10) : null,
        validFrom: Timestamp.fromDate(new Date(data.validFrom)),
        validUntil: Timestamp.fromDate(new Date(data.validUntil + 'T23:59:59')),
        active: data.active,
      }

      const ref = doc(firestore, 'coupons', code)
      if (editing) {
        await updateDoc(ref, { ...payload, updatedAt: serverTimestamp() })
      } else {
        await setDoc(ref, { ...payload, usedCount: 0, createdAt: serverTimestamp() })
      }
      onClose()
    } catch (err) {
      console.error(err)
      setError('Erro ao salvar. Verifique se o código já existe.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-y-auto max-h-[90vh] rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <h2 className="text-base font-bold text-neutral-900">
            {editing ? 'Editar cupom' : 'Novo cupom'}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          {/* Código */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Código do cupom <span className="text-red-500">*</span>
            </label>
            <input
              {...register('code')}
              disabled={!!editing}
              placeholder="VERDE10"
              className={`${inputCls} uppercase disabled:bg-neutral-100`}
              onChange={(e) => {
                e.target.value = e.target.value.toUpperCase()
                register('code').onChange(e)
              }}
            />
            {errors.code && <p className="mt-1 text-xs text-red-500">{errors.code.message}</p>}
          </div>

          {/* Tipo + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Tipo</label>
              <select {...register('type')} className={inputCls}>
                <option value="percentage">Percentual (%)</option>
                <option value="fixed">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                {type === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'} <span className="text-red-500">*</span>
              </label>
              <input
                {...register('value')}
                type="number"
                step={type === 'percentage' ? '1' : '0.01'}
                min={0}
                max={type === 'percentage' ? 100 : undefined}
                placeholder={type === 'percentage' ? '10' : '5,00'}
                className={inputCls}
              />
              {errors.value && <p className="mt-1 text-xs text-red-500">{errors.value.message}</p>}
            </div>
          </div>

          {/* Restrições de valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Pedido mínimo (R$)</label>
              <input {...register('minOrder')} type="number" step="0.01" min={0} placeholder="0,00" className={inputCls} />
            </div>
            {type === 'percentage' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-neutral-700">Desconto máximo (R$)</label>
                <input {...register('maxDiscount')} type="number" step="0.01" min={0} placeholder="Sem limite" className={inputCls} />
              </div>
            )}
          </div>

          {/* Validade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Válido de <span className="text-red-500">*</span>
              </label>
              <input {...register('validFrom')} type="date" className={inputCls} />
              {errors.validFrom && <p className="mt-1 text-xs text-red-500">{errors.validFrom.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Válido até <span className="text-red-500">*</span>
              </label>
              <input {...register('validUntil')} type="date" className={inputCls} />
              {errors.validUntil && <p className="mt-1 text-xs text-red-500">{(errors.validUntil as { message?: string }).message}</p>}
            </div>
          </div>

          {/* Uso máximo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Uso máximo (em branco = ilimitado)</label>
            <input {...register('maxUses')} type="number" min={1} placeholder="Ilimitado" className={inputCls} />
          </div>

          {/* Ativo */}
          <label className="flex cursor-pointer items-center gap-3">
            <input {...register('active')} type="checkbox" className="h-4 w-4 rounded border-neutral-300 accent-brand-500" />
            <span className="text-sm font-medium text-neutral-700">Cupom ativo</span>
          </label>

          {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar cupom'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── page ──────────────────────────────────────────────────

export default function CuponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Coupon | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(firestore, 'coupons'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setCoupons(snap.docs.map((d) => ({ ...d.data(), code: d.id }) as Coupon))
      setLoading(false)
    }, (err) => {
      console.error('coupons error:', err.code)
      setLoading(false)
    })
    return unsub
  }, [])

  async function handleDelete(code: string) {
    if (!window.confirm(`Excluir cupom ${code}?`)) return
    setDeleting(code)
    try {
      await deleteDoc(doc(firestore, 'coupons', code))
    } catch (err) {
      console.error('delete error:', err)
    } finally {
      setDeleting(null)
    }
  }

  async function toggleActive(c: Coupon) {
    try {
      await updateDoc(doc(firestore, 'coupons', c.code), { active: !c.active })
    } catch (err) {
      console.error('toggle error:', err)
    }
  }

  function openCreate() { setEditing(null); setModalOpen(true) }
  function openEdit(c: Coupon) { setEditing(c); setModalOpen(true) }
  function closeModal() { setModalOpen(false); setEditing(null) }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Cupons</h1>
          <p className="mt-0.5 text-sm text-neutral-500">{coupons.length} cupom{coupons.length !== 1 ? 'ns' : ''} cadastrado{coupons.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + Novo cupom
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : coupons.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl mb-2">🏷️</p>
            <p className="font-semibold text-neutral-700">Nenhum cupom cadastrado</p>
            <button onClick={openCreate} className="mt-4 text-sm text-brand-500 hover:underline">
              Criar primeiro cupom →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-5 py-3 text-left">Código</th>
                  <th className="px-5 py-3 text-left">Desconto</th>
                  <th className="px-5 py-3 text-left">Validade</th>
                  <th className="px-5 py-3 text-center">Usos</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {coupons.map((c) => {
                  const expired = isExpired(c.validUntil)
                  const exhausted = c.maxUses != null && c.usedCount >= c.maxUses

                  return (
                    <tr key={c.code} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <span className="font-mono font-bold text-neutral-800">{c.code}</span>
                      </td>
                      <td className="px-5 py-3 text-neutral-700">
                        {c.type === 'percentage'
                          ? `${c.value}%`
                          : formatCurrency(c.value)}
                        {c.minOrderValueInCents
                          ? <span className="ml-1 text-xs text-neutral-400">mín. {formatCurrency(c.minOrderValueInCents)}</span>
                          : null}
                      </td>
                      <td className="px-5 py-3 text-neutral-500">
                        {fmtDate(c.validFrom)} → {fmtDate(c.validUntil)}
                        {expired && <span className="ml-1.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Expirado</span>}
                      </td>
                      <td className="px-5 py-3 text-center text-neutral-700">
                        {c.usedCount}{c.maxUses != null ? `/${c.maxUses}` : ''}
                        {exhausted && <span className="ml-1.5 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">Esgotado</span>}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => toggleActive(c)}
                          className={[
                            'rounded-full px-2.5 py-1 text-xs font-semibold transition-colors',
                            c.active && !expired && !exhausted
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                              : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
                          ].join(' ')}
                        >
                          {c.active && !expired && !exhausted ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="text-xs text-brand-500 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(c.code)}
                            disabled={deleting === c.code}
                            className="text-xs text-red-500 hover:underline disabled:opacity-50"
                          >
                            {deleting === c.code ? '…' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && <CouponModal editing={editing} onClose={closeModal} />}
    </div>
  )
}
