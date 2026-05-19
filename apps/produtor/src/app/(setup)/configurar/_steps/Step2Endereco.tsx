'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import type { ProdutorAddress } from '@marketplace/shared-types'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { Step2Data } from '../page'

const schema = z.object({
  cep: z.string().min(8, 'CEP inválido').max(9),
  street: z.string().min(3, 'Rua obrigatória'),
  number: z.string().min(1, 'Número obrigatório'),
  complement: z.string().optional(),
  neighborhood: z.string().min(2, 'Bairro obrigatório'),
  city: z.string().min(2, 'Cidade obrigatória'),
  state: z.string().length(2, 'UF inválida (2 letras)'),
})

type FormData = z.infer<typeof schema>

interface ViaCepResponse {
  erro?: boolean
  logradouro: string
  bairro: string
  localidade: string
  uf: string
}

interface Props {
  initialData: Step2Data | null
  onNext: (data: Step2Data) => void
  onBack: () => void
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function Step2Endereco({ initialData, onNext, onBack }: Props) {
  const [fetching, setFetching] = useState(false)
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: initialData?.address ?? {},
  })

  async function handleCepBlur(cep: string) {
    const clean = cep.replace(/\D/g, '')
    if (clean.length !== 8) return
    setFetching(true)
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${clean}/json/`)
      const data = (await resp.json()) as ViaCepResponse
      if (!data.erro) {
        setValue('street', data.logradouro, { shouldValidate: true })
        setValue('neighborhood', data.bairro, { shouldValidate: true })
        setValue('city', data.localidade, { shouldValidate: true })
        setValue('state', data.uf, { shouldValidate: true })
      }
    } catch {
      // Ignora falhas do ViaCEP — usuário preenche manualmente
    } finally {
      setFetching(false)
    }
  }

  function onSubmit(data: FormData) {
    const address: ProdutorAddress = {
      cep: data.cep.replace(/\D/g, ''),
      street: data.street,
      number: data.number,
      complement: data.complement,
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state.toUpperCase(),
    }
    onNext({ address })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Localização da horta</h2>
        <p className="mt-1 text-sm text-neutral-500">Onde sua produção está localizada.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            CEP <span className="text-error">*</span>
          </label>
          <div className="relative">
            <input
              {...register('cep')}
              placeholder="00000-000"
              onBlur={(e) => handleCepBlur(e.target.value)}
              className={inputCls}
            />
            {fetching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
              </div>
            )}
          </div>
          {errors.cep && (
            <p className="mt-1 text-xs text-error">{errors.cep.message}</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Rua / Logradouro <span className="text-error">*</span>
          </label>
          <input
            {...register('street')}
            placeholder="Estrada do Campo"
            className={inputCls}
          />
          {errors.street && (
            <p className="mt-1 text-xs text-error">{errors.street.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Número <span className="text-error">*</span>
          </label>
          <input {...register('number')} placeholder="123" className={inputCls} />
          {errors.number && (
            <p className="mt-1 text-xs text-error">{errors.number.message}</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Complemento
          </label>
          <input
            {...register('complement')}
            placeholder="Sítio Boa Vista, Lote 3"
            className={inputCls}
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Bairro <span className="text-error">*</span>
          </label>
          <input
            {...register('neighborhood')}
            placeholder="Zona Rural"
            className={inputCls}
          />
          {errors.neighborhood && (
            <p className="mt-1 text-xs text-error">{errors.neighborhood.message}</p>
          )}
        </div>
        <div className="col-span-2">
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Cidade <span className="text-error">*</span>
          </label>
          <input {...register('city')} placeholder="São Paulo" className={inputCls} />
          {errors.city && (
            <p className="mt-1 text-xs text-error">{errors.city.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            UF <span className="text-error">*</span>
          </label>
          <input
            {...register('state')}
            placeholder="SP"
            maxLength={2}
            className={`${inputCls} uppercase`}
          />
          {errors.state && (
            <p className="mt-1 text-xs text-error">{errors.state.message}</p>
          )}
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
