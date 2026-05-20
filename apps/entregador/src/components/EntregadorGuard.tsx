'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import { doc, getDoc } from 'firebase/firestore'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function EntregadorGuard({ children }: { children: React.ReactNode }) {
  const { user, claims, loading } = useAuth()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (claims?.role === 'entregador') {
      setReady(true)
      return
    }

    // Usuário autenticado sem role de entregador: verifica se já enviou cadastro
    getDoc(doc(firestore, 'deliveryDrivers', user.uid))
      .then((snap) => {
        if (snap.exists()) {
          router.replace('/aguardando-aprovacao')
        } else {
          router.replace('/configurar')
        }
      })
      .catch(() => router.replace('/configurar'))
  }, [user, claims, loading, router])

  if (loading || !ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return <>{children}</>
}
