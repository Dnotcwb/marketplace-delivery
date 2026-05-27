'use client'

import { useEffect } from 'react'

interface Props {
  error: Error & { digest?: string }
  reset: () => void
}

export default function MainError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="text-5xl">⚠️</span>
      <h2 className="text-lg font-semibold text-neutral-800">
        Algo deu errado
      </h2>
      <p className="max-w-sm text-sm text-neutral-500">
        Não foi possível carregar esta página. Verifique sua conexão ou tente novamente.
      </p>
      <button
        onClick={reset}
        className="rounded-xl bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Tentar novamente
      </button>
    </div>
  )
}
