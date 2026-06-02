'use client'

import { auth, firestore } from '@marketplace/shared-firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function CadastroPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: name })
      await setDoc(doc(firestore, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        name,
        phoneVerified: false,
        role: 'cliente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      // Novo produtor vai direto para o wizard de configuração
      router.push('/configurar')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.')
      } else {
        setError('Não foi possível criar sua conta. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mb-4 flex justify-center">
          <img src="/logo.png" alt="Brota" className="h-16 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Cadastrar horta</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Já tem conta?{' '}
          <Link href="/login" className="font-medium text-brand-500 hover:underline">
            Entrar
          </Link>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
            Seu nome completo
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Maria da Silva"
          />
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            placeholder="Mínimo 6 caracteres"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? 'Criando conta…' : 'Criar conta e configurar horta'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Ao criar uma conta você concorda com nossos{' '}
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>{' '}
        e{' '}
        <Link href="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  )
}
