'use client'

import { firestore } from '@marketplace/shared-firebase'
import { updateHorta } from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useHorta } from '@/components/HortaGuard'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', suspended: 'Suspenso', rejected: 'Rejeitado',
}
const STATUS_CLS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-red-100 text-red-700',
  rejected: 'bg-neutral-100 text-neutral-500',
}

export default function ProdutorDetalhePage({ params }: { params: { id: string } }) {
  const { horta, hortaId } = useHorta()
  const router = useRouter()
  const [produtor, setProdutor] = useState<Produtor | null>(null)
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState('')

  useEffect(() => {
    getDoc(doc(firestore, 'produtores', params.id))
      .then((snap) => {
        if (snap.exists()) setProdutor({ id: snap.id, ...snap.data() } as Produtor)
      })
      .finally(() => setLoading(false))
  }, [params.id])

  async function handleRemover() {
    if (!produtor) return
    if (!confirm(`Remover "${produtor.name}" desta horta?`)) return
    setRemoving(true)
    setRemoveError('')
    try {
      await updateDoc(doc(firestore, 'produtores', produtor.id), { hortaId: null })
      const newIds = horta.produtorIds.filter((id) => id !== produtor.id)
      await updateHorta(hortaId, { produtorIds: newIds })
      router.push('/produtores')
    } catch (err: unknown) {
      setRemoveError(err instanceof Error ? err.message : 'Erro ao remover.')
      setRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!produtor) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="text-sm text-brand-600 hover:underline">← Voltar</button>
        <p className="text-neutral-500">Produtor não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <button onClick={() => router.back()} className="mb-1 text-xs text-brand-600 hover:underline">← Produtores</button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-neutral-900">{produtor.name}</h1>
            <span className={['rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_CLS[produtor.status] ?? ''].join(' ')}>
              {STATUS_LABEL[produtor.status] ?? produtor.status}
            </span>
          </div>
          {produtor.description && <p className="mt-1 text-sm text-neutral-500">{produtor.description}</p>}
        </div>
        <button
          onClick={handleRemover}
          disabled={removing}
          className="shrink-0 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          {removing ? 'Removendo…' : 'Remover da horta'}
        </button>
      </div>

      {removeError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{removeError}</p>}

      {/* Banner + Logo */}
      <div className="relative h-36 rounded-xl overflow-hidden bg-brand-100">
        {produtor.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produtor.bannerUrl} alt="banner" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🌿</div>
        )}
        {produtor.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={produtor.logoUrl} alt="logo" className="absolute bottom-3 left-4 h-14 w-14 rounded-full border-2 border-white object-cover shadow" />
        )}
      </div>

      {/* Dados cadastrais */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Dados cadastrais</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {produtor.email && <div><p className="text-xs text-neutral-400">E-mail</p><p className="font-medium">{produtor.email}</p></div>}
          {produtor.phone && <div><p className="text-xs text-neutral-400">Telefone</p><p className="font-medium">{produtor.phone}</p></div>}
          {produtor.document && <div><p className="text-xs text-neutral-400">CPF/CNPJ</p><p className="font-medium">{produtor.document}</p></div>}
          <div><p className="text-xs text-neutral-400">Slug</p><p className="font-medium text-neutral-600">{produtor.slug}</p></div>
        </div>
      </section>

      {/* Endereço */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Endereço</h2>
        <div className="text-sm text-neutral-700 space-y-0.5">
          <p>{produtor.address.street}{produtor.address.number && `, ${produtor.address.number}`}</p>
          <p>{produtor.address.neighborhood} — {produtor.address.city}/{produtor.address.state}</p>
          {produtor.address.cep && <p className="text-neutral-400">CEP {produtor.address.cep}</p>}
        </div>
      </section>

      {/* Operação */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Operação</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><p className="text-xs text-neutral-400">Taxa de entrega</p><p className="font-medium">R$ {(produtor.deliveryFeeInCents / 100).toFixed(2)}</p></div>
          <div><p className="text-xs text-neutral-400">Pedido mínimo</p><p className="font-medium">R$ {(produtor.minOrderValueInCents / 100).toFixed(2)}</p></div>
          <div><p className="text-xs text-neutral-400">Tempo estimado</p><p className="font-medium">{produtor.estimatedDeliveryTimeMin}–{produtor.estimatedDeliveryTimeMax} min</p></div>
          <div><p className="text-xs text-neutral-400">Status loja</p>
            <span className={['inline-flex rounded-full px-2 py-0.5 text-xs font-medium', produtor.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'].join(' ')}>
              {produtor.isOpen ? 'Aberta' : 'Fechada'}
            </span>
          </div>
        </div>
      </section>

      {/* Certificações */}
      {produtor.certifications && produtor.certifications.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Certificações</h2>
          <div className="flex flex-wrap gap-2">
            {produtor.certifications.map((c) => (
              <span key={c} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">{c.replace(/_/g, ' ')}</span>
            ))}
          </div>
        </section>
      )}

      {/* Horários */}
      {produtor.openingHours && produtor.openingHours.length > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Horários de funcionamento</h2>
          <div className="space-y-1.5">
            {produtor.openingHours.map((h) => (
              <div key={h.dayOfWeek} className="flex items-center justify-between text-sm">
                <span className="w-8 font-medium text-neutral-700">{DIAS[h.dayOfWeek]}</span>
                {h.open
                  ? <span className="text-neutral-600">{h.openTime} – {h.closeTime}</span>
                  : <span className="text-neutral-400">Fechado</span>
                }
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
