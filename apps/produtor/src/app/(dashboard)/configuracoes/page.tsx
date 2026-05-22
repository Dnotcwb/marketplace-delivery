'use client'

import { updateProdutor } from '@marketplace/shared-services'
import type { ProdutorCertification } from '@marketplace/shared-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

// ─── helpers ───────────────────────────────────────────────
const CERTS: { value: ProdutorCertification; label: string }[] = [
  { value: 'organico', label: 'Orgânico certificado' },
  { value: 'agroecologico', label: 'Agroecológico' },
  { value: 'natural', label: 'Natural' },
  { value: 'biodynamico', label: 'Biodinâmico' },
  { value: 'sem_agrotoxicos', label: 'Sem agrotóxicos' },
]

function centsToStr(v: number) {
  return (v / 100).toFixed(2).replace('.', ',')
}
function strToCents(v: string) {
  const n = parseFloat(v.replace(',', '.'))
  return Math.round((isNaN(n) ? 0 : n) * 100)
}

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

// ─── schemas ───────────────────────────────────────────────
const basicSchema = z.object({
  name: z.string().min(3, 'Mínimo 3 caracteres').max(80),
  description: z.string().min(20, 'Mínimo 20 caracteres').max(500),
  phone: z.string().min(10, 'Mínimo 10 dígitos').max(15),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  website: z.string().url('URL inválida').optional().or(z.literal('')),
})

const opSchema = z
  .object({
    deliveryFee: z.string().min(1, 'Obrigatório'),
    minOrder: z.string().min(1, 'Obrigatório'),
    timeMin: z.coerce.number().min(1).max(600),
    timeMax: z.coerce.number().min(1).max(600),
    certifications: z.array(z.string()).default([]),
  })
  .refine((d) => d.timeMax >= d.timeMin, {
    message: 'Tempo máximo deve ser ≥ mínimo',
    path: ['timeMax'],
  })

type BasicForm = z.infer<typeof basicSchema>
type OpForm = z.infer<typeof opSchema>

// ─── component ─────────────────────────────────────────────
export default function ConfiguracoesPage() {
  const { produtor, loading } = useProdutorAtivo()

  const [basicStatus, setBasicStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')
  const [opStatus, setOpStatus] = useState<'idle' | 'saving' | 'ok' | 'err'>('idle')

  // — Dados básicos form
  const {
    register: regBasic,
    handleSubmit: handleBasic,
    reset: resetBasic,
    watch: watchBasic,
    formState: { errors: errBasic },
  } = useForm<BasicForm>({ resolver: zodResolver(basicSchema) })

  // — Operação form
  const {
    register: regOp,
    handleSubmit: handleOp,
    reset: resetOp,
    watch: watchOp,
    setValue: setOpValue,
    formState: { errors: errOp },
  } = useForm<OpForm>({ resolver: zodResolver(opSchema) })

  // Populate forms once produtor loads
  useEffect(() => {
    if (!produtor) return
    resetBasic({
      name: produtor.name,
      description: produtor.description,
      phone: produtor.phone,
      email: produtor.email ?? '',
      website: produtor.website ?? '',
    })
    resetOp({
      deliveryFee: centsToStr(produtor.deliveryFeeInCents),
      minOrder: centsToStr(produtor.minOrderValueInCents),
      timeMin: produtor.estimatedDeliveryTimeMin,
      timeMax: produtor.estimatedDeliveryTimeMax,
      certifications: produtor.certifications ?? [],
    })
  }, [produtor, resetBasic, resetOp])

  const desc = watchBasic('description') ?? ''
  const selectedCerts = (watchOp('certifications') ?? []) as ProdutorCertification[]

  function toggleCert(v: ProdutorCertification) {
    const next = selectedCerts.includes(v)
      ? selectedCerts.filter((c) => c !== v)
      : [...selectedCerts, v]
    setOpValue('certifications', next)
  }

  async function saveBasic(data: BasicForm) {
    if (!produtor) return
    setBasicStatus('saving')
    try {
      await updateProdutor(produtor.id, {
        name: data.name,
        description: data.description,
        phone: data.phone,
        ...(data.email ? { email: data.email } : {}),
        ...(data.website ? { website: data.website } : {}),
      })
      setBasicStatus('ok')
      setTimeout(() => setBasicStatus('idle'), 3000)
    } catch {
      setBasicStatus('err')
    }
  }

  async function saveOp(data: OpForm) {
    if (!produtor) return
    setOpStatus('saving')
    try {
      await updateProdutor(produtor.id, {
        deliveryFeeInCents: strToCents(data.deliveryFee),
        minOrderValueInCents: strToCents(data.minOrder),
        estimatedDeliveryTimeMin: data.timeMin,
        estimatedDeliveryTimeMax: data.timeMax,
        certifications: (data.certifications ?? []) as ProdutorCertification[],
      })
      setOpStatus('ok')
      setTimeout(() => setOpStatus('idle'), 3000)
    } catch {
      setOpStatus('err')
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
        Nenhuma horta encontrada.
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900">Configurações</h1>

      {/* ── Dados básicos ── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-bold text-neutral-800">Dados da horta</h2>
        <form onSubmit={handleBasic(saveBasic)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Nome da horta <span className="text-red-500">*</span>
            </label>
            <input {...regBasic('name')} className={inputCls} />
            {errBasic.name && <p className="mt-1 text-xs text-red-500">{errBasic.name.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Descrição <span className="text-red-500">*</span>
            </label>
            <textarea {...regBasic('description')} rows={4} className={`${inputCls} resize-none`} />
            <div className="mt-1 flex justify-between">
              {errBasic.description
                ? <p className="text-xs text-red-500">{errBasic.description.message}</p>
                : <span />}
              <span className="text-xs text-neutral-400">{desc.length}/500</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                WhatsApp / Telefone <span className="text-red-500">*</span>
              </label>
              <input {...regBasic('phone')} placeholder="(11) 99999-9999" className={inputCls} />
              {errBasic.phone && <p className="mt-1 text-xs text-red-500">{errBasic.phone.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">E-mail</label>
              <input {...regBasic('email')} type="email" placeholder="contato@horta.com" className={inputCls} />
              {errBasic.email && <p className="mt-1 text-xs text-red-500">{errBasic.email.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Site / Instagram</label>
            <input {...regBasic('website')} placeholder="https://..." className={inputCls} />
            {errBasic.website && <p className="mt-1 text-xs text-red-500">{errBasic.website.message}</p>}
          </div>

          <div className="flex items-center justify-between pt-1">
            {basicStatus === 'ok' && (
              <p className="text-sm font-medium text-emerald-600">Salvo com sucesso!</p>
            )}
            {basicStatus === 'err' && (
              <p className="text-sm text-red-500">Erro ao salvar. Tente novamente.</p>
            )}
            {basicStatus !== 'ok' && basicStatus !== 'err' && <span />}
            <button
              type="submit"
              disabled={basicStatus === 'saving'}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {basicStatus === 'saving' ? 'Salvando…' : 'Salvar dados'}
            </button>
          </div>
        </form>
      </section>

      {/* ── Operação e entregas ── */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-base font-bold text-neutral-800">Operação e entregas</h2>
        <form onSubmit={handleOp(saveOp)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Taxa de entrega (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">R$</span>
                <input {...regOp('deliveryFee')} placeholder="0,00" className={`${inputCls} pl-9`} />
              </div>
              <p className="mt-1 text-xs text-neutral-400">0,00 = entrega gratuita</p>
              {errOp.deliveryFee && <p className="mt-1 text-xs text-red-500">{errOp.deliveryFee.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Pedido mínimo (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">R$</span>
                <input {...regOp('minOrder')} placeholder="50,00" className={`${inputCls} pl-9`} />
              </div>
              {errOp.minOrder && <p className="mt-1 text-xs text-red-500">{errOp.minOrder.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Tempo mínimo de entrega (min)</label>
              <input {...regOp('timeMin')} type="number" min={1} placeholder="30" className={inputCls} />
              {errOp.timeMin && <p className="mt-1 text-xs text-red-500">{errOp.timeMin.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Tempo máximo de entrega (min)</label>
              <input {...regOp('timeMax')} type="number" min={1} placeholder="60" className={inputCls} />
              {errOp.timeMax && <p className="mt-1 text-xs text-red-500">{(errOp.timeMax as { message?: string }).message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-neutral-700">Certificações</label>
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

          <div className="flex items-center justify-between pt-1">
            {opStatus === 'ok' && (
              <p className="text-sm font-medium text-emerald-600">Salvo com sucesso!</p>
            )}
            {opStatus === 'err' && (
              <p className="text-sm text-red-500">Erro ao salvar. Tente novamente.</p>
            )}
            {opStatus !== 'ok' && opStatus !== 'err' && <span />}
            <button
              type="submit"
              disabled={opStatus === 'saving'}
              className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {opStatus === 'saving' ? 'Salvando…' : 'Salvar operação'}
            </button>
          </div>
        </form>
      </section>

    </div>
  )
}
