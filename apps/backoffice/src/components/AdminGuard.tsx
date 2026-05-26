'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, claims } = useAuth()
  const router = useRouter()
  const role = claims?.role
  const verified = useRef(false)

  // Uma vez confirmado como admin, nunca mais exibe spinner durante navegação
  if (!loading && user && role === 'admin') {
    verified.current = true
  }

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.replace('/login')
      return
    }
    if (role && role !== 'admin') {
      router.replace('/acesso-negado')
    }
  }, [loading, user, role, router])

  if (!verified.current && (loading || !user || role !== 'admin')) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
