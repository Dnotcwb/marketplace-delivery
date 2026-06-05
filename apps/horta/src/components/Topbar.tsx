'use client'

import { useAuth } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useHorta } from './HortaGuard'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const { horta } = useHorta()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const inicial = user?.displayName?.charAt(0).toUpperCase()
    ?? user?.email?.charAt(0).toUpperCase()
    ?? 'H'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-xl p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 lg:hidden"
          aria-label="Abrir menu"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Status da horta */}
        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
            horta.status === 'active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-neutral-100 text-neutral-500',
          ].join(' ')}
        >
          <span
            className={[
              'h-2 w-2 shrink-0 rounded-full',
              horta.status === 'active' ? 'bg-emerald-500' : 'bg-neutral-400',
            ].join(' ')}
            aria-hidden="true"
          />
          <span className="hidden sm:inline font-semibold">{horta.name}</span>
          <span className="sm:hidden">Horta</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            {horta.status === 'active' ? 'Ativa' : 'Inativa'}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
            aria-hidden="true"
          >
            {inicial}
          </div>
          <div className="hidden flex-col lg:flex">
            <span className="text-sm font-semibold leading-none text-neutral-900">
              {user?.displayName ?? 'Responsável'}
            </span>
            <span className="mt-0.5 text-xs leading-none text-neutral-400">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
            aria-label="Sair da conta"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
