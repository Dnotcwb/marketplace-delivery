'use client'

import { firestore } from '@marketplace/shared-firebase'
import { zodResolver } from '@hookform/resolvers/zod'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  platformCommissionPct: z.coerce.number().min(0).max(100),
  minDeliveryFeeInCents: z.coerce.number().min(0),
  maxDeliveryFeeInCents: z.coerce.number().min(0),
  platformName: z.string().min(2).max(60),
  supportEmail: z.string().email('E-mail inválido'),
  supportPhone: z.string().optional().default(''),
})

type FormData = z.infer<typeof schema>

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

export default function ConfiguracoesAdminPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    getDoc(doc(firestore, 'appConfig', 'platform'))
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data()
          reset({
            platformCommissionPct: d['platformCommissionPct'] ?? 10,
            minDeliveryFeeInCents: (d['minDeliveryFeeInCents'] ?? 0) / 100,
            maxDeliveryFeeInCents: (d['maxDeliveryFeeInCents'] ?? 2000) / 100,
            platformName: d['platformName'] ?? 'Brota',
            supportEmail: d['supportEmail'] ?? '',
            supportPhone: d['supportPhone'] ?? '',
          })
        } else {
          reset({
            platformCommissionPct: 10,
            minDeliveryFeeInCents: 0,
            maxDeliveryFeeInCents: 20,
            platformName: 'Brota',
            supportEmail: '',
            supportPhone: '',
          })
        }
      })
      .catch((err) => console.error('appConfig read error:', err))
      .finally(() => setLoading(false))
  }, [reset])

  async function onSubmit(data: FormData) {
    setStatus('saving')
    try {
      await setDoc(doc(firestore, 'appConfig', 'platform'), {
        platformCommissionPct: data.platformCommissionPct,
        minDeliveryFeeInCents: Math.round(data.minDeliveryFeeInCents * 100),
        maxDeliveryFeeInCents: Math.round(data.maxDeliveryFeeInCents * 100),
        platformName: data.platformName,
        supportEmail: data.supportEmail,
        supportPhone: data.supportPhone,
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 3000)
    } catch (err) {
      console.error('appConfig write error:', err)
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Configurações da plataforma</h1>
        <p className="mt-0.5 text-sm text-neutral-500">Parâmetros globais do Brota.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Geral */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-neutral-800">Geral</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome da plataforma</label>
            <input {...register('platformName')} className={inputCls} />
            {errors.platformName && <p className="mt-1 text-xs text-red-500">{errors.platformName.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail de suporte</label>
              <input {...register('supportEmail')} type="email" placeholder="suporte@exemplo.com" className={inputCls} />
              {errors.supportEmail && <p className="mt-1 text-xs text-red-500">{errors.supportEmail.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Telefone de suporte</label>
              <input {...register('supportPhone')} placeholder="(11) 99999-9999" className={inputCls} />
            </div>
          </div>
        </section>

        {/* Financeiro */}
        <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-neutral-800">Taxas e comissões</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Comissão padrão da plataforma (%)
            </label>
            <div className="relative">
              <input
                {...register('platformCommissionPct')}
                type="number"
                min={0}
                max={100}
                step={0.5}
                placeholder="10"
                className={`${inputCls} pr-8`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Aplicada por padrão a novos produtores. Pode ser sobrescrita por produtor.
            </p>
            {errors.platformCommissionPct && <p className="mt-1 text-xs text-red-500">{errors.platformCommissionPct.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Taxa de entrega mínima (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">R$</span>
                <input {...register('minDeliveryFeeInCents')} type="number" min={0} step={0.5} placeholder="0,00" className={`${inputCls} pl-9`} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Taxa de entrega máxima (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">R$</span>
                <input {...register('maxDeliveryFeeInCents')} type="number" min={0} step={0.5} placeholder="20,00" className={`${inputCls} pl-9`} />
              </div>
            </div>
          </div>
        </section>

        {/* Salvar */}
        <div className="flex items-center justify-between">
          {status === 'ok' && <p className="text-sm font-medium text-emerald-600">Configurações salvas!</p>}
          {status === 'err' && <p className="text-sm text-red-500">Erro ao salvar. Tente novamente.</p>}
          {status !== 'ok' && status !== 'err' && <span />}
          <button
            type="submit"
            disabled={status === 'saving'}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {status === 'saving' ? 'Salvando…' : 'Salvar configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
