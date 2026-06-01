'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import { doc, getDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type GuardState = 'checking' | 'ready' | 'activating' | 'go_configurar' | 'go_aguardando' | 'go_login' | 'error'

export default function EntregadorGuard({ children }: { children: React.ReactNode }) {
  const { user, claims, loading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<GuardState>('checking')

  useEffect(() => {
    if (loading) return
    if (!user) { setState('go_login'); return }

    async function check() {
      setState('checking')

      // 1. Só força refresh se ainda não tiver o role correto (evita chamada de rede desnecessária)
      let role: string | undefined = claims?.role
      if (role !== 'entregador') {
        try {
          const fresh = await user!.getIdTokenResult(true)
          role = fresh.claims['role'] as string | undefined
        } catch {
          // Usa o claim já carregado se o refresh falhar
        }
      }

      // 2. Tem o role correto → entra no dashboard
      if (role === 'entregador') {
        setState('ready')
        return
      }

      // 3. Sem o role — consulta o Firestore para saber o estado do cadastro
      try {
        const snap = await getDoc(doc(firestore, 'deliveryDrivers', user!.uid))

        if (!snap.exists()) {
          // Nunca preencheu o perfil → vai configurar
          setState('go_configurar')
          return
        }

        const status = snap.data()?.status as string | undefined

        if (status === 'approved') {
          // Admin aprovou mas o claim ainda não propagou
          // O token já foi force-refreshed acima e ainda não tem o role →
          // mantém na tela de aguardo com botão para recarregar
          setState('activating')
        } else {
          // pending_approval, rejected, suspended → aguarda
          setState('go_aguardando')
        }
      } catch (err) {
        console.error('EntregadorGuard getDoc error:', err)
        // Não redireciona para /configurar em caso de erro — mostra tela de erro
        setState('error')
      }
    }

    check()
  }, [user, loading]) // eslint-disable-line react-hooks/exhaustive-deps — claims intencionalmente omitido para evitar loop

  // Navegação fora do render
  useEffect(() => {
    if (state === 'go_login')      router.replace('/login')
    if (state === 'go_configurar') router.replace('/configurar')
    if (state === 'go_aguardando') router.replace('/aguardando-aprovacao')
  }, [state, router])

  if (state === 'ready') return <>{children}</>

  if (state === 'activating') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-bold text-neutral-900">Cadastro aprovado!</p>
        <p className="text-sm text-neutral-500 max-w-xs">
          Seu acesso está sendo ativado. Clique no botão abaixo para entrar.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Entrar no app
        </button>
        <p className="text-xs text-neutral-400">
          Se não funcionar, faça logout e login novamente.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <p className="font-semibold text-neutral-800">Erro ao verificar acesso</p>
        <p className="text-sm text-neutral-500">Verifique sua conexão e tente novamente.</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  )
}
