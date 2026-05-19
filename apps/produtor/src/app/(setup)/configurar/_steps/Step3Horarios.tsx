'use client'

import type { ProdutorHours } from '@marketplace/shared-types'
import { useState } from 'react'
import type { Step3Data } from '../page'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const DEFAULT_HOURS: ProdutorHours[] = DAYS.map((_, i) => ({
  dayOfWeek: i as ProdutorHours['dayOfWeek'],
  open: i >= 1 && i <= 5, // seg–sex abertas por padrão
  openTime: '08:00',
  closeTime: '18:00',
}))

interface Props {
  initialData: Step3Data | null
  onNext: (data: Step3Data) => void
  onBack: () => void
}

export default function Step3Horarios({ initialData, onNext, onBack }: Props) {
  const [hours, setHours] = useState<ProdutorHours[]>(
    initialData?.openingHours ?? DEFAULT_HOURS,
  )

  function toggleDay(i: number) {
    setHours((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, open: !h.open } : h)),
    )
  }

  function setTime(i: number, field: 'openTime' | 'closeTime', value: string) {
    setHours((prev) =>
      prev.map((h, idx) => (idx === i ? { ...h, [field]: value } : h)),
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Horários de disponibilidade</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Quando sua horta aceita pedidos? Você pode ajustar a qualquer momento.
        </p>
      </div>

      <div className="space-y-2">
        {hours.map((h, i) => (
          <div
            key={h.dayOfWeek}
            className={[
              'flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors',
              h.open ? 'border-brand-200 bg-brand-50/40' : 'border-neutral-200 bg-white',
            ].join(' ')}
          >
            <button
              type="button"
              role="switch"
              aria-checked={h.open}
              aria-label={`${DAYS[i]} ${h.open ? 'aberto' : 'fechado'}`}
              onClick={() => toggleDay(i)}
              className={[
                'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors',
                h.open ? 'bg-brand-500' : 'bg-neutral-300',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  h.open ? 'translate-x-4' : 'translate-x-0.5',
                ].join(' ')}
              />
            </button>

            <span
              className={[
                'w-20 text-sm font-medium',
                h.open ? 'text-neutral-900' : 'text-neutral-400',
              ].join(' ')}
            >
              {DAYS[i]}
            </span>

            {h.open ? (
              <div className="ml-auto flex items-center gap-2">
                <input
                  type="time"
                  value={h.openTime ?? '08:00'}
                  onChange={(e) => setTime(i, 'openTime', e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                />
                <span className="text-sm text-neutral-400">até</span>
                <input
                  type="time"
                  value={h.closeTime ?? '18:00'}
                  onChange={(e) => setTime(i, 'closeTime', e.target.value)}
                  className="rounded-md border border-neutral-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
            ) : (
              <span className="ml-auto text-xs text-neutral-400">Fechado</span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={() => onNext({ openingHours: hours })}
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Próximo →
        </button>
      </div>
    </div>
  )
}
