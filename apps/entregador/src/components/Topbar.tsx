'use client'

import { useAuth } from '@marketplace/shared-services'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/', label: 'Entregas', icon: '🚀' },
  { href: '/historico', label: 'Histórico', icon: '📋' },
  { href: '/ganhos', label: 'Ganhos', icon: '💰' },
]

export default function Topbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const inicial = user?.displayName?.charAt(0).toUpperCase()
    ?? user?.email?.charAt(0).toUpperCase()
    ?? 'E'

  async function handleLogout() {
    setMenuOpen(false)
    await logout()
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Logo */}
        <span className="font-bold text-brand-600 text-lg">🛵 Entregador</span>

        {/* Nav links */}
        <nav className="hidden sm:flex flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {item.icon} {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1 sm:hidden" />

        {/* User avatar + menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen((p) => !p)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
          >
            {inicial}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 w-48 rounded-xl border border-neutral-200 bg-white shadow-lg">
              <div className="border-b border-neutral-100 px-4 py-3">
                <p className="text-sm font-medium text-neutral-900 truncate">{user?.displayName ?? 'Entregador'}</p>
                <p className="text-xs text-neutral-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 rounded-b-xl"
              >
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom mobile nav */}
      <nav className="flex sm:hidden border-t border-neutral-100">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors ${
                active ? 'text-brand-600' : 'text-neutral-400'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
