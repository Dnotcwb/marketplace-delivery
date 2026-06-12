'use client'

import { auth } from '@marketplace/shared-firebase'
import { subscribeToHortaById } from '@marketplace/shared-services'
import { useAuth } from '@marketplace/shared-services'
import type { Horta } from '@marketplace/shared-types'
import { signOut } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

// ── Context ──────────────────────────────────────────────

interface HortaContextValue {
  horta: Horta
  hortaId: string
}

export const HortaContext = createContext<HortaContextValue | null>(null)

export function useHorta(): HortaContextValue {
  const ctx = useContext(HortaContext)
  if (!ctx) throw new Error('useHorta must be used inside HortaGuard')
  return ctx
}

// ── Guard ────────────────────────────────────────────────

type GuardState =
  | 'checking'
  | 'ready'
  | 'go_login'
  | 'go_negado'
  | 'no_horta'
  | 'error'

export default function HortaGuard({ children }: { children: React.ReactNode }) {
  const { user, claims, loading, claimsLoading } = useAuth()
  const router = useRouter()
  const [state, setState] = useState<GuardState>('checking')
  const [horta, setHorta] = useState<Horta | null>(null)
  const [hortaId, setHortaId] = useState<string | null>(null)

  useEffect(() => {
    if (loading || claimsLoading) return
    if (!user) { setState('go_login'); return }

    async function check() {
      setState('checking')

      let role: string | undefined = claims?.role as string | undefined
      let resolvedHortaId: string | undefined = (claims as unknown as Record<string, unknown>)?.['hortaId'] as string | undefined

      // Só força refresh do token se ainda não tivermos role+hortaId resolvidos
      // (evita um round-trip de rede ao abrir o app já vinculado).
      if (role !== 'horta' || !resolvedHortaId) {
        try {
          const fresh = await user!.getIdTokenResult(true)
          role = fresh.claims['role'] as string | undefined
          resolvedHortaId = fresh.claims['hortaId'] as string | undefined
        } catch {
          // usa claims em cache se o refresh falhar
        }
      }

      if (role !== 'horta') {
        setState('go_negado')
        return
      }

      if (!resolvedHortaId) {
        setState('no_horta')
        return
      }

      setHortaId(resolvedHortaId)
    }

    check()
  }, [user, loading, claimsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscription em tempo real assim que temos o hortaId
  useEffect(() => {
    if (!hortaId) return

    return subscribeToHortaById(hortaId, (h) => {
      if (!h) {
        setState('no_horta')
        setHorta(null)
        return
      }
      setHorta(h)
      setState('ready')
    })
  }, [hortaId])

  // Redirects
  useEffect(() => {
    if (state === 'go_login') router.replace('/login')
    if (state === 'go_negado') router.replace('/acesso-negado')
  }, [state, router])

  // ── Telas de estado ───────────────────────────────────

  if (state === 'ready' && horta && hortaId) {
    return (
      <HortaContext.Provider value={{ horta, hortaId }}>
        {children}
      </HortaContext.Provider>
    )
  }

  if (state === 'no_horta') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <div className="text-5xl">🌱</div>
        <p className="text-xl font-bold text-neutral-900">Nenhuma horta vinculada</p>
        <p className="mt-1 text-sm text-neutral-500 max-w-xs">
          Seu perfil ainda não está vinculado a uma horta. Entre em contato com o administrador da plataforma.
        </p>
        <button
          onClick={async () => { await signOut(auth); router.replace('/login') }}
          className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Sair
        </button>
      </div>
    )
  }

  if (state === 'go_negado') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
        <div className="text-5xl">🚫</div>
        <p className="text-xl font-bold text-neutral-900">Acesso não autorizado</p>
        <p className="mt-1 text-sm text-neutral-500 max-w-xs">
          Esta área é exclusiva para responsáveis de horta.
        </p>
        <button
          onClick={async () => { await signOut(auth); router.replace('/login') }}
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
        <p className="font-semibold text-neutral-800">Erro ao carregar horta</p>
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
