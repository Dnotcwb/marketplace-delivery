'use client'

import { useAuth } from '@marketplace/shared-services'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function Header() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [search, setSearch] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/busca?q=${encodeURIComponent(search.trim())}`)
    }
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const inicial = user?.displayName?.charAt(0).toUpperCase() ?? user?.email?.charAt(0).toUpperCase() ?? 'U'

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex flex-shrink-0 items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🍔</span>
          <span className="hidden font-bold text-neutral-900 sm:block">Delivery</span>
        </Link>

        {/* Busca */}
        <form onSubmit={handleSearch} className="flex flex-1 items-center">
          <div className="relative w-full max-w-xl">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar restaurantes ou pratos"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </form>

        {/* Ações */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Carrinho (placeholder — implementado na Etapa 3) */}
          <button
            className="relative rounded-full p-2 hover:bg-neutral-100"
            aria-label="Ver carrinho"
          >
            <svg className="h-6 w-6 text-neutral-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </button>

          {/* Usuário */}
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {inicial}
                </div>
                <span className="max-w-[6rem] truncate">{user.displayName ?? user.email}</span>
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-neutral-200 px-4 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
