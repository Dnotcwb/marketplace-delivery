'use client'

import { useRequireRole } from '@marketplace/shared-services'

export default function ProdutorGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireRole('produtor', false)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
