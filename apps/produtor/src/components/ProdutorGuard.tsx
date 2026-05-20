'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ProdutorGuard({ children }: { children: React.ReactNode }) {
  const { user, claims, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/login')
      return
    }

    const role = claims?.role

    if (role === 'produtor') return

    // Usuário autenticado mas sem perfil de produtor → vai configurar a horta
    if (!role || role === 'cliente') {
      router.replace('/configurar')
      return
    }

    // Outro role (admin, entregador) → não pertence a este app
    router.replace('/acesso-negado')
  }, [user, claims, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  // Enquanto o redirect não acontece, não renderiza nada
  if (!user || claims?.role !== 'produtor') {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
