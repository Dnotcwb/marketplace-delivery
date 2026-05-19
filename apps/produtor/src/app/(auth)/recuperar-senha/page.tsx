'use client'

import { auth } from '@marketplace/shared-firebase'
import { sendPasswordResetEmail } from 'firebase/auth'
import Link from 'next/link'
import { useState } from 'react'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await sendPasswordResetEmail(auth, email)
      setSent(true)
    } catch {
      setError('Não foi possível enviar o e-mail. Verifique o endereço informado.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">📧</div>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900">E-mail enviado</h1>
        <p className="mb-6 text-neutral-500">
          Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
        </p>
        <Link href="/login" className="text-sm font-medium text-brand-500 hover:underline">
          Voltar para o login
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Recuperar senha</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Informe seu e-mail para receber o link de redefinição.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
            E-mail
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="horta@email.com"
          />
        </div>

        {error && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-brand-500 hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  )
}
