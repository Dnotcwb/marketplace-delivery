'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Step1Data } from '../page'

const schema = z.object({
  name: z.string().min(3, 'Nome deve ter ao menos 3 caracteres').max(80),
  document: z.string().max(14).optional().or(z.literal('')),
  phone: z.string().min(10, 'Telefone deve ter ao menos 10 dígitos').max(15),
  description: z
    .string()
    .min(20, 'Descrição deve ter ao menos 20 caracteres')
    .max(500),
})

type FormData = z.infer<typeof schema>

interface Props {
  initialData: Step1Data | null
  onNext: (data: Step1Data) => void
}

export default function Step1Basicos({ initialData, onNext }: Props) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData ?? {},
  })

  const desc = watch('description') ?? ''

  return (
    <form onSubmit={handleSubmit((d) => onNext(d as Step1Data))} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Dados do produtor</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Como os consumidores vão te encontrar no Brota.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Nome do produtor <span className="text-error">*</span>
        </label>
        <input
          {...register('name')}
          placeholder="Ex: Horta do Vale Verde"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-error">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            CPF / CNPJ
          </label>
          <input
            {...register('document')}
            placeholder="Somente números"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {errors.document && (
            <p className="mt-1 text-xs text-error">{errors.document.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            WhatsApp / Telefone <span className="text-error">*</span>
          </label>
          <input
            {...register('phone')}
            placeholder="(11) 99999-9999"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-error">{errors.phone.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Descrição do produtor <span className="text-error">*</span>
        </label>
        <textarea
          {...register('description')}
          rows={4}
          placeholder="Conte sobre sua produção, diferenciais, o que você cultiva..."
          className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <div className="mt-1 flex justify-between">
          {errors.description ? (
            <p className="text-xs text-error">{errors.description.message}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-neutral-400">{desc.length}/500</span>
        </div>
      </div>

      <div className="flex justify-end pt-2">
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
