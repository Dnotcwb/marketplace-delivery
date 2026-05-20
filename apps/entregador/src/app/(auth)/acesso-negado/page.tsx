'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'

export default function AcessoNegadoPage() {
  const { logout } = useAuth()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-4 text-6xl">🚫</div>
      <h1 className="text-2xl font-bold text-neutral-900">Acesso negado</h1>
      <p className="mt-3 text-sm text-neutral-500">
        Sua conta não tem permissão para acessar o app de entregadores.
      </p>
      <button
        onClick={handleLogout}
        className="mt-6 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        Sair da conta
      </button>
    </div>
  )
}
