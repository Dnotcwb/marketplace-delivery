'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type GuardState =
  | 'checking'
  | 'ready'
  | 'activating'       // aprovado mas claim ainda não propagou
  | 'go_configurar'    // sem produtores doc → wizard
  | 'go_aguardando'    // cadastro pendente/rejeitado
  | 'go_login'
  | 'go_negado'
  | 'error'

export default function ProdutorGuard({ children }: { children: React.ReactNode }) {
  const { user, claims, loading, claimsLoading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<GuardState>('checking')

  useEffect(() => {
    if (loading || claimsLoading) return
    if (!user) { setState('go_login'); return }

    async function check() {
      setState('checking')

      // 1. Força refresh do token apenas se ainda não tiver o role correto
      let role: string | undefined = claims?.role
      if (role !== 'produtor') {
        try {
          const fresh = await user!.getIdTokenResult(true)
          role = fresh.claims['role'] as string | undefined
        } catch {
          // Se o refresh falhar usa o claim já carregado
        }
      }

      // 2. Token já tem o role correto → entra no dashboard
      if (role === 'produtor') {
        setState('ready')
        return
      }

      // 3. Outro role que não pertence a este app
      if (role && role !== 'cliente') {
        setState('go_negado')
        return
      }

      // 4. Role = 'cliente' ou ausente → consulta o Firestore para saber o estado do cadastro
      try {
        const snap = await getDocs(
          query(
            collection(firestore, 'produtores'),
            where('ownerUid', '==', user!.uid),
            limit(1),
          ),
        )

        if (snap.empty) {
          // Nunca completou o wizard → vai configurar
          setState('go_configurar')
          return
        }

        const produtorStatus = snap.docs[0]!.data().status as string | undefined

        if (produtorStatus === 'approved') {
          // Admin aprovou mas o custom claim ainda não propagou no token
          setState('activating')
        } else {
          // pending, rejected, suspended → tela de aguardo
          setState('go_aguardando')
        }
      } catch (err) {
        console.error('ProdutorGuard Firestore error:', err)
        setState('error')
      }
    }

    check()
  }, [user, loading, claimsLoading]) // eslint-disable-line react-hooks/exhaustive-deps — claims omitido intencionalmente; claimsLoading garante que o token foi lido antes de decidir

  // Navegação fora do render
  useEffect(() => {
    if (state === 'go_login')      router.replace('/login')
    if (state === 'go_configurar') router.replace('/configurar')
    if (state === 'go_aguardando') router.replace('/aguardando-aprovacao')
    if (state === 'go_negado')     router.replace('/acesso-negado')
  }, [state, router])

  if (state === 'ready') return <>{children}</>

  if (state === 'activating') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-bold text-neutral-900">Cadastro aprovado!</p>
        <p className="mt-1 text-sm text-neutral-500 max-w-xs">
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

  // Checking / redirect em andamento
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  )
}
