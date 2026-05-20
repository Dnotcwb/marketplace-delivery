'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AcessoNegadoPage() {
  const { logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">🚫</div>
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Acesso negado</h1>
      <p className="mb-6 text-neutral-500">
        Sua conta não tem permissão para acessar o painel do produtor.
        Se você é um produtor aprovado, saia e entre com a conta correta.
      </p>
      <div className="flex flex-col gap-3">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg bg-brand-500 px-6 py-2 font-medium text-white hover:bg-brand-600"
        >
          Sair e trocar de conta
        </button>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-700 hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
