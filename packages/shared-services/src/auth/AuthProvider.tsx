'use client'

import { auth } from '@marketplace/shared-firebase'
import type { UserRole } from '@marketplace/shared-types'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useState } from 'react'

export interface AuthClaims {
  role: UserRole
  restaurantIds?: string[]
  approved?: boolean
}

interface AuthContextValue {
  user: User | null
  claims: AuthClaims | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<AuthClaims | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)

      if (firebaseUser) {
        const tokenResult = await firebaseUser.getIdTokenResult()
        const role = (tokenResult.claims['role'] as UserRole | undefined) ?? 'cliente'
        const restaurantIds = tokenResult.claims['restaurantIds'] as string[] | undefined
        const approved = tokenResult.claims['approved'] as boolean | undefined
        setClaims({
          role,
          ...(restaurantIds !== undefined && { restaurantIds }),
          ...(approved !== undefined && { approved }),
        })
      } else {
        setClaims(null)
      }

      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function signInWithEmail(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function logout() {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, claims, loading, signInWithEmail, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
