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
  produtorIds?: string[]
  approved?: boolean
}

interface AuthContextValue {
  user: User | null
  claims: AuthClaims | null
  /** True until Firebase resolves the user identity from cache (~50ms). Use this to gate basic auth checks. */
  loading: boolean
  /** True until getIdTokenResult() resolves (~300–500ms). Use this in role-based guards before reading `claims`. */
  claimsLoading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [claims, setClaims] = useState<AuthClaims | null>(null)
  const [loading, setLoading] = useState(true)
  const [claimsLoading, setClaimsLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false) // unblocks UI immediately — user identity known from IndexedDB cache

      if (firebaseUser) {
        setClaimsLoading(true)
        firebaseUser.getIdTokenResult().then((tokenResult) => {
          const role = (tokenResult.claims['role'] as UserRole | undefined) ?? 'cliente'
          const produtorIds = tokenResult.claims['produtorIds'] as string[] | undefined
          const approved = tokenResult.claims['approved'] as boolean | undefined
          setClaims({
            role,
            ...(produtorIds !== undefined && { produtorIds }),
            ...(approved !== undefined && { approved }),
          })
          setClaimsLoading(false)
        })
      } else {
        setClaims(null)
        setClaimsLoading(false)
      }
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
    <AuthContext.Provider value={{ user, claims, loading, claimsLoading, signInWithEmail, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
