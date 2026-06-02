'use client'

import type { UserRole } from '@marketplace/shared-types'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from './AuthProvider'

export function useRequireRole(expectedRole: UserRole, requireApproval = false) {
  const { user, claims, loading, claimsLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || claimsLoading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (claims?.role !== expectedRole) {
      router.replace('/acesso-negado')
      return
    }

    if (requireApproval && !claims.approved) {
      router.replace('/aguardando-aprovacao')
    }
  }, [user, claims, loading, claimsLoading, expectedRole, requireApproval, router])

  return { user, claims, loading, claimsLoading }
}
