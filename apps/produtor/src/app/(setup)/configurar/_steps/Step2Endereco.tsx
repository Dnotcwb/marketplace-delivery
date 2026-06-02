'use client'

import { listHortasAtivas } from '@marketplace/shared-services'
import type { Horta } from '@marketplace/shared-types'
import { useEffect, useState } from 'react'
import type { Step2Data } from '../page'

interface Props {
  initialData: Step2Data | null
  onNext: (data: Step2Data) => void
  onBack: () => void
}


export default function Step2Horta({ initialData, onNext, onBack }: Props) {
  const [hortas, setHortas] = useState<Horta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>(initialData?.hortaId ?? '')

  useEffect(() => {
    listHortasAtivas()
      .then(setHortas)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const horta = hortas.find((h) => h.id === selectedId)
    if (!horta) return
    onNext({
      hortaId: horta.id,
      address: horta.address,
      deliveryFeeInCents: horta.deliveryFeeInCents,
      minOrderValueInCents: horta.minOrderValueInCents,
      estimatedDeliveryTimeMin: horta.estimatedDeliveryTimeMin,
      estimatedDeliveryTimeMax: horta.estimatedDeliveryTimeMax,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Selecione sua horta</h2>
        <p className="mt-1 text-sm text-neutral-500">
          O endereço da horta será usado como ponto de saída para cálculo das entregas.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        </div>
      ) : hortas.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-neutral-700">Nenhuma horta disponível</p>
          <p className="mt-1 text-xs text-neutral-400">
            Aguarde um administrador cadastrar uma horta antes de continuar.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hortas.map((horta) => {
            const selected = selectedId === horta.id
            return (
              <button
                key={horta.id}
                type="button"
                onClick={() => setSelectedId(horta.id)}
                className={[
                  'w-full rounded-xl border-2 px-4 py-4 text-left transition-colors',
                  selected
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-neutral-200 bg-white hover:border-brand-300',
                ].join(' ')}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      selected ? 'border-brand-500 bg-brand-500' : 'border-neutral-300 bg-white',
                    ].join(' ')}
                  >
                    {selected && (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{horta.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">
                      {horta.address.street}, {horta.address.number}
                      {horta.address.complement ? ` — ${horta.address.complement}` : ''} ·{' '}
                      {horta.address.neighborhood}, {horta.address.city} — {horta.address.state}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={!selectedId || hortas.length === 0}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-40"
        >
          Próximo →
        </button>
      </div>
    </form>
  )
}
