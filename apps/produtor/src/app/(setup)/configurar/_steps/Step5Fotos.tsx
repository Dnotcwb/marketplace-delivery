'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import type { Step4Data } from '../page'

interface Props {
  onNext: (data: Step4Data) => void
  onBack: () => void
  submitting: boolean
}

export default function Step5Fotos({ onNext, onBack, submitting }: Props) {
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [bannerPreview, setBannerPreview] = useState<string | null>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerFile(file)
    setBannerPreview(URL.createObjectURL(file))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-neutral-900">Fotos do produtor</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Uma boa foto atrai muito mais clientes. Você pode atualizar depois.
        </p>
      </div>

      {/* Logo */}
      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700">
          Foto / Logo
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => logoRef.current?.click()}
            className="h-24 w-24 cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-brand-400"
          >
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="Preview do logo"
                width={96}
                height={96}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg className="h-8 w-8 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </button>
          <div>
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {logoFile ? logoFile.name : 'Escolher foto'}
            </button>
            <p className="mt-0.5 text-xs text-neutral-400">PNG, JPG até 2MB. Quadrada recomendada.</p>
          </div>
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>
      </div>

      {/* Banner */}
      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-700">
          Banner (capa da página)
        </label>
        <button
          type="button"
          onClick={() => bannerRef.current?.click()}
          className="h-40 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 transition-colors hover:border-brand-400"
        >
          {bannerPreview ? (
            <Image
              src={bannerPreview}
              alt="Preview do banner"
              width={640}
              height={160}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center">
              <svg className="h-10 w-10 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-1 text-xs text-neutral-400">Clique para escolher o banner</p>
              <p className="text-xs text-neutral-400">1200×400px recomendado</p>
            </div>
          )}
        </button>
        <input
          ref={bannerRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerChange}
        />
      </div>

      <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3">
        <p className="text-sm text-brand-700">
          As fotos são opcionais — você pode pular e adicionar depois nas configurações.
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-lg border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          onClick={() =>
            onNext({
              logoFile: logoFile ?? undefined,
              bannerFile: bannerFile ?? undefined,
            })
          }
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-70"
        >
          {submitting && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {submitting ? 'Salvando...' : 'Finalizar cadastro'}
        </button>
      </div>
    </div>
  )
}
