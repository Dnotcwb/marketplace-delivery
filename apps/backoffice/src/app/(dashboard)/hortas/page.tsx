'use client'

import { firestore } from '@marketplace/shared-firebase'
import type { Horta, Produtor } from '@marketplace/shared-types'
import {
  callAssignHortaManager,
  callSetUserRole,
  createHorta,
  deleteHorta,
  removeHortaOwner,
  subscribeToHortas,
  updateHorta,
} from '@marketplace/shared-services'
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { useEffect, useState } from 'react'

// ──────────────────────────────────────────────────────
//  Modal de Horta (criar / editar)
// ──────────────────────────────────────────────────────

interface HortaModalProps {
  editing: Horta | null
  onClose: () => void
}

function HortaModal({ editing, onClose }: HortaModalProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [slug, setSlug] = useState(editing?.slug ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [street, setStreet] = useState(editing?.address.street ?? '')
  const [number, setNumber] = useState(editing?.address.number ?? '')
  const [neighborhood, setNeighborhood] = useState(editing?.address.neighborhood ?? '')
  const [city, setCity] = useState(editing?.address.city ?? '')
  const [state, setState] = useState(editing?.address.state ?? '')
  const [cep, setCep] = useState(editing?.address.cep ?? '')
  const [deliveryFee, setDeliveryFee] = useState(
    editing ? (editing.deliveryFeeInCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [minOrder, setMinOrder] = useState(
    editing ? (editing.minOrderValueInCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [timeMin, setTimeMin] = useState(String(editing?.estimatedDeliveryTimeMin ?? 30))
  const [timeMax, setTimeMax] = useState(String(editing?.estimatedDeliveryTimeMax ?? 60))
  const [feePerKm, setFeePerKm] = useState(
    editing?.deliveryFeePerKmInCents
      ? (editing.deliveryFeePerKmInCents / 100).toFixed(2).replace('.', ',')
      : '',
  )
  const [radiusKm, setRadiusKm] = useState(String(editing?.deliveryRadiusKm ?? 0))
  const [lat, setLat] = useState(String(editing?.lat ?? ''))
  const [lng, setLng] = useState(String(editing?.lng ?? ''))
  const [geocoding, setGeocoding] = useState(false)
  const [status, setStatus] = useState<'active' | 'inactive'>(editing?.status ?? 'active')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function parseCents(v: string) {
    return Math.round(parseFloat(v.replace(',', '.') || '0') * 100)
  }

  function toSlug(v: string) {
    return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  async function handleGeocode() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) { setError('CEP inválido para geocodificar'); return }
    setGeocoding(true)
    setError('')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`,
        { headers: { 'User-Agent': 'marketplace-delivery-backoffice/1.0' } },
      )
      const data = await res.json() as Array<{ lat: string; lon: string }>
      if (!data.length) { setError('CEP não encontrado no Nominatim'); return }
      setLat(parseFloat(data[0]!.lat).toFixed(6))
      setLng(parseFloat(data[0]!.lon).toFixed(6))
    } catch {
      setError('Erro ao geocodificar. Tente novamente.')
    } finally {
      setGeocoding(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) { setError('Nome e slug são obrigatórios'); return }
    setSaving(true)
    setError('')
    try {
      const parsedLat = parseFloat(lat)
      const parsedLng = parseFloat(lng)
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        address: { cep, street, number, neighborhood, city, state },
        deliveryFeeInCents: parseCents(deliveryFee),
        deliveryFeePerKmInCents: parseCents(feePerKm),
        deliveryRadiusKm: parseFloat(radiusKm) || 0,
        ...(parsedLat && parsedLng ? { lat: parsedLat, lng: parsedLng } : {}),
        minOrderValueInCents: parseCents(minOrder),
        estimatedDeliveryTimeMin: parseInt(timeMin) || 30,
        estimatedDeliveryTimeMax: parseInt(timeMax) || 60,
        status,
        produtorIds: editing?.produtorIds ?? [],
      }
      if (editing) {
        await updateHorta(editing.id, payload)
      } else {
        await createHorta(payload)
      }
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          {editing ? 'Editar Horta' : 'Nova Horta'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Nome *</label>
              <input value={name} onChange={(e) => { setName(e.target.value); if (!editing) setSlug(toSlug(e.target.value)) }} className={inputCls} placeholder="Horta Centro Cívico" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Slug *</label>
              <input value={slug} onChange={(e) => setSlug(toSlug(e.target.value))} className={inputCls} placeholder="horta-centro-civico" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Endereço</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Rua</label>
              <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Número</label>
              <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">CEP</label>
              <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Bairro</label>
              <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Cidade</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
            </div>
          </div>

          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Operação</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Taxa base de entrega (R$)</label>
              <input value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className={inputCls} placeholder="0,00" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Pedido mínimo (R$)</label>
              <input value={minOrder} onChange={(e) => setMinOrder(e.target.value)} className={inputCls} placeholder="0,00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Tempo mín. (min)</label>
              <input type="number" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Tempo máx. (min)</label>
              <input type="number" value={timeMax} onChange={(e) => setTimeMax(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')} className={inputCls}>
                <option value="active">Ativa</option>
                <option value="inactive">Inativa</option>
              </select>
            </div>
          </div>

          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Frete dinâmico (opcional)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Taxa por km (R$/km)</label>
              <input value={feePerKm} onChange={(e) => setFeePerKm(e.target.value)} className={inputCls} placeholder="0,00 = frete fixo" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Raio máx. (km)</label>
              <input type="number" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} className={inputCls} placeholder="0 = ilimitado" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Latitude</label>
              <input value={lat} onChange={(e) => setLat(e.target.value)} className={inputCls} placeholder="-25.430" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Longitude</label>
              <input value={lng} onChange={(e) => setLng(e.target.value)} className={inputCls} placeholder="-49.271" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleGeocode}
            disabled={geocoding}
            className="w-full rounded-lg border border-neutral-300 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
          >
            {geocoding ? 'Geocodificando…' : 'Preencher lat/lng pelo CEP acima'}
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Modal de Responsável
// ──────────────────────────────────────────────────────

interface ResponsavelModalProps {
  horta: Horta
  onClose: () => void
}

function ResponsavelModal({ horta, onClose }: ResponsavelModalProps) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setError('Informe o email do responsável'); return }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const result = await callAssignHortaManager(trimmed, horta.id)
      setSuccess(`${result.name} (${result.email}) atribuído como responsável.`)
      setEmail('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atribuir responsável.'
      // Firebase Functions wraps the message inside details
      const detail = (err as { details?: string })?.details
      setError(detail ?? msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!horta.ownerUid) return
    setRemoving(true)
    setError('')
    setSuccess('')
    try {
      await callSetUserRole({ uid: horta.ownerUid, role: 'cliente' })
      await removeHortaOwner(horta.id)
      setSuccess('Responsável removido com sucesso.')
    } catch {
      setError('Erro ao remover responsável. Tente novamente.')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Responsável</h2>
            <p className="text-xs text-neutral-500">{horta.name}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Responsável atual */}
          {horta.ownerUid ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-2">Responsável atual</p>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 truncate">{horta.ownerName ?? '—'}</p>
                  <p className="text-sm text-neutral-500 truncate">{horta.ownerEmail ?? '—'}</p>
                </div>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  {removing ? 'Removendo…' : 'Remover'}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-sm text-neutral-500">Nenhum responsável atribuído.</p>
            </div>
          )}

          {/* Atribuir novo responsável */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {horta.ownerUid ? 'Substituir responsável' : 'Atribuir responsável'}
            </p>
            <p className="mb-3 text-xs text-neutral-500">
              O usuário deve ter uma conta criada no sistema. Informe o email cadastrado.
            </p>
            <form onSubmit={handleAssign} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
              >
                {saving ? '…' : 'Atribuir'}
              </button>
            </form>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}
          {success && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>
          )}
        </div>

        <div className="flex justify-end border-t border-neutral-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Modal de Atribuição de Produtores
// ──────────────────────────────────────────────────────

interface AtribuirProdutoresModalProps {
  horta: Horta
  onClose: () => void
}

function AtribuirProdutoresModal({ horta, onClose }: AtribuirProdutoresModalProps) {
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [saving, setSaving] = useState(false)
  const [assigned, setAssigned] = useState<Set<string>>(new Set(horta.produtorIds))

  useEffect(() => {
    getDocs(
      query(collection(firestore, 'produtores'), where('status', '==', 'approved')),
    ).then((snap) => {
      setProdutores(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor))
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const assignedList = [...assigned]
      const updates: Promise<void>[] = []

      for (const pid of assignedList) {
        updates.push(updateDoc(doc(firestore, 'produtores', pid), { hortaId: horta.id }))
      }
      for (const pid of horta.produtorIds) {
        if (!assigned.has(pid)) {
          updates.push(updateDoc(doc(firestore, 'produtores', pid), { hortaId: null }))
        }
      }
      await Promise.all(updates)
      await updateHorta(horta.id, { produtorIds: assignedList })
      onClose()
    } catch {
      // silencioso
    } finally {
      setSaving(false)
    }
  }

  function toggle(pid: string) {
    setAssigned((prev) => {
      const next = new Set(prev)
      next.has(pid) ? next.delete(pid) : next.add(pid)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-bold text-neutral-900">Produtores — {horta.name}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {produtores.length === 0 && (
            <p className="text-sm text-neutral-400">Nenhum produtor aprovado encontrado.</p>
          )}
          {produtores.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={assigned.has(p.id)}
                onChange={() => toggle(p.id)}
                className="h-4 w-4 rounded border-neutral-300 text-brand-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{p.name}</p>
                <p className="text-xs text-neutral-400 truncate">{p.slug}</p>
              </div>
              {p.hortaId && p.hortaId !== horta.id && (
                <span className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">outra horta</span>
              )}
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Modal de Confirmação de Exclusão
// ──────────────────────────────────────────────────────

interface DeleteModalProps {
  horta: Horta
  onConfirm: () => void
  onCancel: () => void
  deleting: boolean
}

function DeleteModal({ horta, onConfirm, onCancel, deleting }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-neutral-900">Deletar horta</p>
            <p className="text-sm text-neutral-500">{horta.name}</p>
          </div>
        </div>
        {horta.ownerUid && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Esta horta possui um responsável vinculado. Ao deletar, o perfil dele será revertido para cliente.
          </p>
        )}
        <p className="mb-5 text-sm text-neutral-600">
          Esta ação é permanente e não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={deleting} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-60">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={deleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
            {deleting ? 'Deletando…' : 'Deletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function HortasPage() {
  const [hortas, setHortas] = useState<Horta[]>([])
  const [modal, setModal] = useState<{ open: boolean; editing: Horta | null }>({ open: false, editing: null })
  const [atribuirModal, setAtribuirModal] = useState<Horta | null>(null)
  const [responsavelModal, setResponsavelModal] = useState<Horta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Horta | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    return subscribeToHortas(setHortas)
  }, [])

  async function handleDelete(horta: Horta) {
    setDeleting(true)
    try {
      if (horta.ownerUid) {
        await callSetUserRole({ uid: horta.ownerUid, role: 'cliente' }).catch(() => {})
      }
      await deleteHorta(horta.id)
      setDeleteTarget(null)
    } catch {
      // silencioso
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {modal.open && (
        <HortaModal
          editing={modal.editing}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
      {atribuirModal && (
        <AtribuirProdutoresModal
          horta={atribuirModal}
          onClose={() => setAtribuirModal(null)}
        />
      )}
      {responsavelModal && (
        <ResponsavelModal
          horta={responsavelModal}
          onClose={() => setResponsavelModal(null)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          horta={deleteTarget}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Hortas</h1>
            <p className="text-sm text-neutral-500">Espaços físicos que agrupam múltiplos produtores.</p>
          </div>
          <button
            onClick={() => setModal({ open: true, editing: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nova Horta
          </button>
        </div>

        {hortas.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400">
            Nenhuma horta cadastrada ainda.
          </div>
        ) : (
          <div className="space-y-3">
            {hortas.map((h) => (
              <div key={h.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-neutral-900">{h.name}</h3>
                      <span className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        h.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-neutral-100 text-neutral-500',
                      ].join(' ')}>
                        {h.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {h.address.neighborhood}, {h.address.city} — {h.produtorIds.length} produtor(es)
                    </p>

                    {/* Responsável */}
                    <div className="mt-2 flex items-center gap-2">
                      {h.ownerUid ? (
                        <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium">{h.ownerName ?? h.ownerEmail}</span>
                        </div>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-600">
                          Sem responsável
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex gap-3 text-xs text-neutral-400">
                      <span>Frete: R$ {(h.deliveryFeeInCents / 100).toFixed(2)}</span>
                      <span>Mín: R$ {(h.minOrderValueInCents / 100).toFixed(2)}</span>
                      <span>{h.estimatedDeliveryTimeMin}–{h.estimatedDeliveryTimeMax} min</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => setResponsavelModal(h)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Responsável
                    </button>
                    <button
                      onClick={() => setAtribuirModal(h)}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Produtores
                    </button>
                    <button
                      onClick={() => setModal({ open: true, editing: h })}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setDeleteTarget(h)}
                      className="rounded-lg border border-red-200 p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                      title="Deletar horta"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
