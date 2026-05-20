'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AguardandoAprovacaoPage() {
  const { user, loading, claims, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) { router.replace('/login'); return }
    if (claims?.role === 'entregador') { router.replace('/'); return }
  }, [user, loading, claims, router])

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-4 text-6xl">⏳</div>
      <h1 className="text-2xl font-bold text-neutral-900">Cadastro em análise</h1>
      <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
        Seu cadastro foi enviado e está sendo analisado pela nossa equipe.
        Você receberá uma notificação quando for aprovado.
      </p>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-left space-y-2">
        <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">O que acontece agora?</p>
        <ul className="space-y-1.5 text-sm text-neutral-500">
          <li>✅ Dados recebidos com sucesso</li>
          <li>🔍 Equipe analisa o cadastro em até 48h</li>
          <li>📱 Você recebe aprovação por e-mail</li>
          <li>🚀 Acesso liberado para aceitar entregas</li>
        </ul>
      </div>

      <button
        onClick={handleLogout}
        className="mt-8 text-sm text-neutral-400 hover:underline"
      >
        Sair da conta
      </button>
    </div>
  )
}
