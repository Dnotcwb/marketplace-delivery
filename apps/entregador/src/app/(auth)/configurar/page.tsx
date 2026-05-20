'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import { zodResolver } from '@hookform/resolvers/zod'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { updateProfile } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

const schema = z.object({
  displayName: z.string().min(3, 'Nome deve ter ao menos 3 caracteres'),
  phone: z.string().min(10, 'Telefone inválido'),
  vehicleType: z.enum(['moto', 'bicicleta', 'carro', 'van']),
  vehiclePlate: z.string().optional().default(''),
})

type FormData = z.infer<typeof schema>

const inputCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

const VEHICLE_OPTIONS = [
  { value: 'moto', label: '🏍️ Moto' },
  { value: 'bicicleta', label: '🚲 Bicicleta' },
  { value: 'carro', label: '🚗 Carro' },
  { value: 'van', label: '🚐 Van' },
]

export default function ConfigurarPage() {
  const { user, loading, claims } = useAuth()
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { vehicleType: 'moto' },
  })

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (claims?.role === 'entregador') { router.replace('/'); return }
    if (user.displayName) setValue('displayName', user.displayName)
  }, [user, loading, claims, router, setValue])

  async function onSubmit(data: FormData) {
    if (!user) return
    await updateProfile(user, { displayName: data.displayName })
    await setDoc(doc(firestore, 'deliveryDrivers', user.uid), {
      uid: user.uid,
      displayName: data.displayName,
      email: user.email ?? '',
      phone: data.phone,
      vehicleType: data.vehicleType,
      vehiclePlate: data.vehiclePlate ?? '',
      status: 'pending_approval',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    router.replace('/aguardando-aprovacao')
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 text-center">
        <div className="mb-3 text-5xl">🛵</div>
        <h1 className="text-2xl font-bold text-neutral-900">Complete seu perfil</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Preencha os dados abaixo para solicitar aprovação como entregador.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Nome completo</label>
          <input {...register('displayName')} className={inputCls} placeholder="Seu nome completo" />
          {errors.displayName && <p className="mt-1 text-xs text-red-500">{errors.displayName.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Telefone / WhatsApp</label>
          <input
            {...register('phone')}
            type="tel"
            className={inputCls}
            placeholder="(11) 99999-9999"
          />
          {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">Tipo de veículo</label>
          <div className="grid grid-cols-2 gap-2">
            {VEHICLE_OPTIONS.map((opt) => (
              <label key={opt.value} className="cursor-pointer">
                <input {...register('vehicleType')} type="radio" value={opt.value} className="sr-only peer" />
                <div className="rounded-lg border border-neutral-300 px-3 py-2.5 text-center text-sm font-medium text-neutral-600 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">
                  {opt.label}
                </div>
              </label>
            ))}
          </div>
          {errors.vehicleType && <p className="mt-1 text-xs text-red-500">{errors.vehicleType.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Placa do veículo <span className="text-neutral-400">(opcional)</span>
          </label>
          <input
            {...register('vehiclePlate')}
            className={inputCls}
            placeholder="ABC-1234"
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '')
              e.target.value = v
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar para aprovação'}
        </button>
      </form>
    </div>
  )
}
