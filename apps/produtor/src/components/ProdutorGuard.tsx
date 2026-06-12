'use client'

import { auth, firestore } from '@marketplace/shared-firebase'
import { callSelfRevokeOrphanedClaim, useAuth } from '@marketplace/shared-services'
import { signOut } from 'firebase/auth'
import { collection, getDocs, limit, query, where } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type GuardState =
  | 'checking'
  | 'ready'
  | 'activating'      // aprovado no Firestore mas claim ainda não propagou
  | 'revoked'         // claim='produtor' mas sem doc → conta removida
  | 'go_configurar'
  | 'go_aguardando'
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

      // 1. Só força refresh do token se ainda não tiver o role correto
      //    (evita um round-trip de rede ao abrir o app já aprovado).
      let role: string | undefined = claims?.role
      if (role !== 'produtor') {
        try {
          const fresh = await user!.getIdTokenResult(true)
          role = fresh.claims['role'] as string | undefined
        } catch {
          // Se o refresh falhar usa o claim já carregado
        }
      }

      // 2. Outro role que não pertence a este app
      if (role && role !== 'produtor' && role !== 'cliente') {
        setState('go_negado')
        return
      }

      // 3. Verifica existência do documento em `produtores` INDEPENDENTE do role
      //    Garante que claims não fiquem "soltas" após deleção do produtor
      try {
        const snap = await getDocs(
          query(
            collection(firestore, 'produtores'),
            where('ownerUid', '==', user!.uid),
            limit(1),
          ),
        )

        if (snap.empty) {
          if (role === 'produtor') {
            // Claim diz 'produtor' mas o documento foi deletado → estado corrompido
            // Auto-corrige o claim para evitar acesso indevido em sessões futuras
            await callSelfRevokeOrphanedClaim().catch(() => {})
            await signOut(auth)
            setState('revoked')
          } else {
            // Sem doc e sem claim → ainda não completou o wizard
            setState('go_configurar')
          }
          return
        }

        const produtorStatus = snap.docs[0]!.data().status as string | undefined

        if (role === 'produtor') {
          // Tem doc e tem claim correto → entra
          setState('ready')
          return
        }

        // Tem doc mas o claim ainda não foi atualizado
        if (produtorStatus === 'approved') {
          setState('activating') // Admin aprovou mas token ainda não propagou
        } else {
          setState('go_aguardando') // pending, rejected, suspended
        }
      } catch (err) {
        console.error('ProdutorGuard Firestore error:', err)
        setState('error')
      }
    }

    check()
  }, [user, loading, claimsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

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

  if (state === 'revoked') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <div className="text-5xl">🚫</div>
        <p className="text-xl font-bold text-neutral-900">Conta removida</p>
        <p className="mt-1 text-sm text-neutral-500 max-w-xs">
          Esta conta de produtor foi removida da plataforma. Entre em contato com o suporte ou cadastre-se novamente.
        </p>
        <button
          onClick={() => router.replace('/login')}
          className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Voltar ao login
        </button>
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
