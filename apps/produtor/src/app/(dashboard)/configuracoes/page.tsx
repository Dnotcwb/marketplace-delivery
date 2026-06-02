'use client'

import { updateProdutor } from '@marketplace/shared-services'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

const basicSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(80),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(500),
  phone: z.string().min(10, 'Mínimo 10 dígitos').max(15),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
})

type BasicForm = z.infer<typeof basicSchema>

export default function ConfiguracoesPage() {
  const { produtor, loading } = useProdutorAtivo()
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<BasicForm>({ resolver: zodResolver(basicSchema) })

  useEffect(() => {
    if (!produtor) return
    reset({
      name: produtor.name,
      description: produtor.description,
      phone: produtor.phone,
      email: produtor.email ?? '',
      website: produtor.website ?? '',
    })
  }, [produtor, reset])

  const desc = watch('description') ?? ''

  async function onSubmit(data: BasicForm) {
    if (!produtor) return
    setStatus('saving')
    try {
      await updateProdutor(produtor.id, {
        name: data.name,
        description: data.description,
        phone: data.phone,
        ...(data.email ? { email: data.email } : {}),
        ...(data.website ? { website: data.website } : {}),
      })
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 3000)
    } catch {
      setStatus('err')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!produtor) {
    return (
      <div className="p-10 text-center text-sm text-neutral-500">
        Nenhum produtor encontrado.
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Configurações</h1>

      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-bold text-neutral-800">Dados do produtor</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Nome <span className="text-red-500">*</span>
            </label>
            <input {...register('name')} className={inputCls} />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea {...register('description')} rows={4} className={`${inputCls} resize-none`} />
            <div className="mt-1 flex justify-between">
              {errors.description
                ? <p className="text-xs text-red-500">{errors.description.message}</p>
                : <span />}
              <span className="text-xs text-neutral-400">{desc.length}/500</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                WhatsApp / Telefone <span className="text-red-500">*</span>
              </label>
              <input {...register('phone')} placeholder="(11) 99999-9999" className={inputCls} />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
              <input {...register('email')} type="email" placeholder="contato@horta.com" className={inputCls} />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Site / Instagram</label>
            <input {...register('website')} placeholder="https://..." className={inputCls} />
            {errors.website && <p className="mt-1 text-xs text-red-500">{errors.website.message}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            {status === 'ok' && <p className="text-sm font-medium text-emerald-600">Salvo com sucesso!</p>}
            {status === 'err' && <p className="text-sm text-red-500">Erro ao salvar. Tente novamente.</p>}
            {status !== 'ok' && status !== 'err' && <span />}
            <button
              type="submit"
              disabled={status === 'saving'}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {status === 'saving' ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
