'use client'

import { firestore } from '@marketplace/shared-firebase'
import { updateHorta } from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { useHorta } from '@/components/HortaGuard'

// ──────────────────────────────────────────────────────
//  Modal de atribuição de produtores (idêntico ao backoffice)
// ──────────────────────────────────────────────────────

function AtribuirModal({
  hortaId,
  hortaName,
  produtorIds,
  onClose,
}: {
  hortaId: string
  hortaName: string
  produtorIds: string[]
  onClose: () => void
}) {
  const [todos, setTodos] = useState<Produtor[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [phantomCount, setPhantomCount] = useState(0)
  const assignedRef = React.useRef<Set<string>>(new Set(produtorIds))
  const [assigned, setAssignedState] = useState<Set<string>>(new Set(produtorIds))

  function setAssigned(s: Set<string>) {
    assignedRef.current = s
    setAssignedState(s)
  }

  useEffect(() => {
    getDocs(query(collection(firestore, 'produtores'), where('status', '==', 'approved')))
      .then((snap) => {
        const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Produtor)
        setTodos(loaded)
        const validIds = new Set(loaded.map((p) => p.id))
        const cleaned = new Set([...assignedRef.current].filter((id) => validIds.has(id)))
        const removed = assignedRef.current.size - cleaned.size
        if (removed > 0) { setPhantomCount(removed); setAssigned(cleaned) }
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true); setSaveError('')
    try {
      const current = assignedRef.current
      const list = [...current]
      await Promise.all(list.map((pid) =>
        updateDoc(doc(firestore, 'produtores', pid), { hortaId }),
      ))
      await Promise.allSettled(
        produtorIds
          .filter((pid) => !current.has(pid))
          .map((pid) => updateDoc(doc(firestore, 'produtores', pid), { hortaId: null })),
      )
      await updateHorta(hortaId, { produtorIds: list })
      onClose()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  function toggle(pid: string) {
    const next = new Set(assignedRef.current)
    next.has(pid) ? next.delete(pid) : next.add(pid)
    setAssigned(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-base font-bold text-neutral-900">Gerenciar Produtores — {hortaName}</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {phantomCount > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              {phantomCount} ID(s) inválido(s) removido(s) automaticamente. Salve para confirmar.
            </div>
          )}
          {todos.length === 0 && phantomCount === 0 && (
            <p className="text-sm text-neutral-400">Nenhum produtor aprovado encontrado.</p>
          )}
          {todos.map((p) => (
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
              {p.hortaId && p.hortaId !== hortaId && (
                <span className="text-xs text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">outra horta</span>
              )}
            </label>
          ))}
        </div>
        {saveError && (
          <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{saveError}</p>
        )}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-neutral-100">
          <button onClick={onClose} disabled={saving} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-60">
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
//  Labels e cores de status
// ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', suspended: 'Suspenso', rejected: 'Rejeitado',
}
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-neutral-100 text-neutral-500',
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function ProdutoresPage() {
  const { horta, hortaId } = useHorta()
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  function loadProdutores(ids: string[]) {
    if (!ids.length) { setProdutores([]); setLoading(false); return }
    setLoading(true)
    Promise.allSettled(ids.map((id) => getDoc(doc(firestore, 'produtores', id))))
      .then((results) => {
        const found: Produtor[] = []
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value.exists()) {
            found.push({ id: r.value.id, ...r.value.data() } as Produtor)
          }
        }
        setProdutores(found)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadProdutores(horta.produtorIds)
  }, [horta.produtorIds]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {modal && (
        <AtribuirModal
          hortaId={hortaId}
          hortaName={horta.name}
          produtorIds={horta.produtorIds}
          onClose={() => { setModal(false); loadProdutores(horta.produtorIds) }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Produtores</h1>
            <p className="text-sm text-neutral-500">Gerencie os produtores vinculados à {horta.name}.</p>
          </div>
          <button
            onClick={() => setModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Gerenciar
          </button>
        </div>

        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : produtores.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-neutral-300 text-center">
            <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-neutral-500">Nenhum produtor vinculado</p>
              <p className="text-xs text-neutral-400">Clique em "Gerenciar" para adicionar produtores.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {produtores.map((p) => (
              <div key={p.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.logoUrl} alt={p.name} className="h-10 w-10 rounded-full object-cover shrink-0 border border-neutral-200" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg">🌿</div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-neutral-900 truncate">{p.name}</p>
                      <p className="text-xs text-neutral-500 truncate">
                        {p.address?.neighborhood && `${p.address.neighborhood}, `}{p.address?.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={['rounded-full px-2.5 py-1 text-xs font-medium', STATUS_CLS[p.status] ?? 'bg-neutral-100 text-neutral-500'].join(' ')}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                    <Link
                      href={`/produtores/${p.id}`}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                </div>

                {(p.email || p.phone) && (
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-neutral-100 pt-3">
                    {p.email && (
                      <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        {p.email}
                      </a>
                    )}
                    {p.phone && (
                      <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {p.phone}
                      </a>
                    )}
                  </div>
                )}

                {p.certifications && p.certifications.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {p.certifications.map((c) => (
                      <span key={c} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{c.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
