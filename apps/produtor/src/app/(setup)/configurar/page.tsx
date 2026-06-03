'use client'

import { firestore, storage } from '@marketplace/shared-firebase'
import { createProdutor, useAuth } from '@marketplace/shared-services'
import type {
  ProdutorAddress,
  ProdutorHours,
} from '@marketplace/shared-types'
import { slugify } from '@marketplace/shared-utils'
import { collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Step1Basicos from './_steps/Step1Basicos'
import Step2Endereco from './_steps/Step2Endereco'
import Step3Horarios from './_steps/Step3Horarios'
import Step5Fotos from './_steps/Step5Fotos'

const STEPS = ['Dados básicos', 'Horta', 'Horários', 'Fotos']

export type Step1Data = {
  name: string
  document: string
  phone: string
  description: string
}

export type Step2Data = {
  hortaId: string
  address: ProdutorAddress
  deliveryFeeInCents: number
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
}

export type Step3Data = {
  openingHours: ProdutorHours[]
}

export type Step4Data = {
  logoFile?: File
  bannerFile?: File
}

async function uploadFile(file: File, path: string): Promise<string> {
  const storageRef = ref(storage, path)
  const task = uploadBytesResumable(storageRef, file)
  return new Promise((resolve, reject) => {
    // Timeout de 30s — evita spinner eterno em caso de regra bloqueada ou sem rede
    const timeout = setTimeout(() => {
      task.cancel()
      reject(new Error(`Upload timeout: ${path}`))
    }, 8_000)

    task.on(
      'state_changed',
      null,
      (err) => { clearTimeout(timeout); reject(err) },
      () => { clearTimeout(timeout); getDownloadURL(task.snapshot.ref).then(resolve).catch(reject) },
    )
  })
}

export default function ConfigurarPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [step1, setStep1] = useState<Step1Data | null>(null)
  const [step2, setStep2] = useState<Step2Data | null>(null)
  const [step3, setStep3] = useState<Step3Data | null>(null)

  // ID gerado uma única vez para toda a sessão do wizard
  const produtorId = useMemo(
    () => doc(collection(firestore, 'produtores')).id,
    [],
  )

  async function handleFinalStep(data: Step4Data) {
    if (!user || !step1 || !step2 || !step3) return
    setSubmitting(true)
    setError(null)

    try {
      let logoUrl: string | undefined
      let bannerUrl: string | undefined

      if (data.logoFile) {
        try {
          logoUrl = await uploadFile(data.logoFile, `produtores/${produtorId}/logo`)
        } catch (uploadErr) {
          console.warn('Upload da logo falhou — continuando sem foto:', uploadErr)
        }
      }
      if (data.bannerFile) {
        try {
          bannerUrl = await uploadFile(data.bannerFile, `produtores/${produtorId}/banner`)
        } catch (uploadErr) {
          console.warn('Upload do banner falhou — continuando sem foto:', uploadErr)
        }
      }

      await createProdutor(produtorId, {
        slug: slugify(step1.name),
        name: step1.name,
        description: step1.description,
        ownerUid: user.uid,
        email: user.email ?? undefined,
        phone: step1.phone,
        ...(step1.document ? { document: step1.document } : {}),
        hortaId: step2.hortaId,
        address: step2.address,
        ...(logoUrl ? { logoUrl } : {}),
        ...(bannerUrl ? { bannerUrl } : {}),
        isOpen: false,
        openingHours: step3.openingHours,
        deliveryFeeInCents: step2.deliveryFeeInCents,
        minOrderValueInCents: step2.minOrderValueInCents,
        estimatedDeliveryTimeMin: step2.estimatedDeliveryTimeMin,
        estimatedDeliveryTimeMax: step2.estimatedDeliveryTimeMax,
        deliveryRadiusKm: null,
        certifications: [],
        status: 'pending',
        commission: 0,
      })

      // Marca o cadastro como concluído — impede exclusão automática de "fantasmas"
      await updateDoc(doc(firestore, 'users', user.uid), {
        registrationStatus: 'completed',
        updatedAt: serverTimestamp(),
      }).catch(() => { /* não bloqueia o fluxo se falhar */ })

      router.push('/aguardando-aprovacao')
    } catch (err) {
      setError('Erro ao salvar. Verifique sua conexão e tente novamente.')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Progresso */}
      <div className="mb-8">
        <div className="flex items-start">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-start">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                    i < step
                      ? 'bg-brand-500 text-white'
                      : i === step
                        ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                        : 'bg-neutral-200 text-neutral-500',
                  ].join(' ')}
                >
                  {i < step ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={[
                    'mt-1.5 text-xs font-medium',
                    i <= step ? 'text-brand-600' : 'text-neutral-400',
                  ].join(' ')}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={[
                    'mx-1 mt-4 h-0.5 flex-1',
                    i < step ? 'bg-brand-400' : 'bg-neutral-200',
                  ].join(' ')}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo do passo */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        {step === 0 && (
          <Step1Basicos
            initialData={step1}
            onNext={(d: Step1Data) => { setStep1(d); setStep(1) }}
          />
        )}
        {step === 1 && (
          <Step2Endereco
            initialData={step2}
            onNext={(d: Step2Data) => { setStep2(d); setStep(2) }}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <Step3Horarios
            initialData={step3}
            onNext={(d: Step3Data) => { setStep3(d); setStep(3) }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <Step5Fotos
            onNext={handleFinalStep}
            onBack={() => setStep(2)}
            submitting={submitting}
          />
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
