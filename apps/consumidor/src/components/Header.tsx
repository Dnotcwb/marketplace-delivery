'use client'

import { useAuth, useCart } from '@marketplace/shared-services'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Logo from './Logo'
import NotificationBell from './NotificationBell'

export default function Header() {
  const { user, logout } = useAuth()
  const { itemCount, openCart } = useCart()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

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

  const inicial = user?.displayName?.charAt(0).toUpperCase()
    ?? user?.email?.charAt(0).toUpperCase()
    ?? 'U'

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">

        {/* Logo */}
        <Link href="/" className="flex-shrink-0" aria-label="Ambiente Livre — início">
          <Logo variant="full" size={34} />
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
              placeholder="Buscar produtores ou produtos"
              aria-label="Buscar"
              className="w-full rounded-full border border-neutral-200 bg-neutral-50 py-2 pl-10 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </form>

        {/* Ações */}
        <div className="flex flex-shrink-0 items-center gap-2">

          {/* Notificações */}
          <NotificationBell />

          {/* Carrinho */}
          <button
            onClick={openCart}
            className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-600"
            aria-label={`Ver carrinho${itemCount > 0 ? ` — ${itemCount} ${itemCount === 1 ? 'item' : 'itens'}` : ''}`}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {itemCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>

          {/* Usuário autenticado */}
          {user ? (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-neutral-200 py-1.5 pl-1.5 pr-3 text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                aria-expanded={menuOpen}
                aria-haspopup="true"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                  {inicial}
                </span>
                <span className="max-w-[6rem] truncate font-medium">
                  {user.displayName ?? user.email}
                </span>
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-1 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg"
                  onBlur={() => setMenuOpen(false)}
                >
                  <Link
                    href="/perfil"
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Meu perfil
                  </Link>
                  <Link
                    href="/pedidos"
                    role="menuitem"
                    className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Meus pedidos
                  </Link>
                  <div className="my-1 border-t border-neutral-100" />
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm text-error hover:bg-red-50"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="rounded-full px-4 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded-full bg-brand-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
              >
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
