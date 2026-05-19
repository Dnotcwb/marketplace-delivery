'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { ProdutorCertification } from '@marketplace/shared-types'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Step4Data } from '../page'

const CERTS: { value: ProdutorCertification; label: string }[] = [
  { value: 'organico', label: 'Orgânico certificado' },
  { value: 'agroecologico', label: 'Agroecológico' },
  { value: 'natural', label: 'Natural' },
  { value: 'biodynamico', label: 'Biodinâmico' },
  { value: 'sem_agrotoxicos', label: 'Sem agrotóxicos' },
]

const schema = z
  .object({
    deliveryFee: z.string().min(1, 'Obrigatório'),
    minOrder: z.string().min(1, 'Obrigatório'),
    timeMin: z.coerce.number().min(1).max(600),
    timeMax: z.coerce.number().min(1).max(600),
    certifications: z.array(z.string()).default([]),
  })
  .refine((d) => d.timeMax >= d.timeMin, {
    message: 'Tempo máximo deve ser ≥ ao mínimo',
    path: ['timeMax'],
  })

type FormData = z.infer<typeof schema>

interface Props {
  initialData: Step4Data | null
  onNext: (data: Step4Data) => void
  onBack: () => void
}

function centavosToStr(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}

function strToCentavos(value: string): number {
  const num = parseFloat(value.replace(',', '.'))
  return Math.round((isNaN(num) ? 0 : num) * 100)
}

export default function Step4Operacao({ initialData, onNext, onBack }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryFee: initialData ? centavosToStr(initialData.deliveryFeeInCents) : '0,00',
      minOrder: initialData ? centavosToStr(initialData.minOrderValueInCents) : '50,00',
      timeMin: initialData?.estimatedDeliveryTimeMin ?? 30,
      timeMax: initialData?.estimatedDeliveryTimeMax ?? 60,
      certifications: initialData?.certifications ?? [],
    },
  })

  const selectedCerts = watch('certifications') ?? []

  function toggleCert(value: ProdutorCertification) {
    const next = selectedCerts.includes(value)
      ? selectedCerts.filter((c) => c !== value)
      : [...selectedCerts, value]
    setValue('certifications', next)
  }

  function onSubmit(data: FormData) {
    onNext({
      deliveryFeeInCents: strToCentavos(data.deliveryFee),
      minOrderValueInCents: strToCentavos(data.minOrder),
      estimatedDeliveryTimeMin: data.timeMin,
      estimatedDeliveryTimeMax: data.timeMax,
      certifications: (data.certifications ?? []) as ProdutorCertification[],
    })
  }

  const inputCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Operação e entregas</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Configure como funciona sua entrega.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Taxa de entrega (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
              R$
            </span>
            <input
              {...register('deliveryFee')}
              placeholder="0,00"
              className={`${inputCls} pl-9`}
            />
          </div>
          <p className="mt-1 text-xs text-neutral-400">0,00 = entrega gratuita</p>
          {errors.deliveryFee && (
            <p className="mt-1 text-xs text-error">{errors.deliveryFee.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Pedido mínimo (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
              R$
            </span>
            <input
              {...register('minOrder')}
              placeholder="50,00"
              className={`${inputCls} pl-9`}
            />
          </div>
          {errors.minOrder && (
            <p className="mt-1 text-xs text-error">{errors.minOrder.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Tempo mínimo de entrega (min)
          </label>
          <input
            {...register('timeMin')}
            type="number"
            min={1}
            placeholder="30"
            className={inputCls}
          />
          {errors.timeMin && (
            <p className="mt-1 text-xs text-error">{errors.timeMin.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Tempo máximo de entrega (min)
          </label>
          <input
            {...register('timeMax')}
            type="number"
            min={1}
            placeholder="60"
            className={inputCls}
          />
          {errors.timeMax && (
            <p className="mt-1 text-xs text-error">{errors.timeMax.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700">
          Certificações (selecione todas que se aplicam)
        </label>
        <div className="flex flex-wrap gap-2">
          {CERTS.map((cert) => {
            const active = selectedCerts.includes(cert.value)
            return (
              <button
                key={cert.value}
                type="button"
                onClick={() => toggleCert(cert.value)}
                className={[
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-neutral-300 bg-white text-neutral-600 hover:border-brand-400',
                ].join(' ')}
              >
                {cert.label}
              </button>
            )
          })}
        </div>
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
          type="submit"
          className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Próximo →
        </button>
      </div>
    </form>
  )
}
