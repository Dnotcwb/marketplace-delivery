'use client'

import { useAuth } from '@marketplace/shared-services'
import { toggleProdutorOpen } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'
import NotificationBell from './NotificationBell'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth()
  const router = useRouter()
  const { produtor } = useProdutorAtivo()
  const [toggling, setToggling] = useState(false)

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  async function handleToggleOpen() {
    if (!produtor || toggling) return
    setToggling(true)
    try {
      await toggleProdutorOpen(produtor.id, !produtor.isOpen)
    } finally {
      setToggling(false)
    }
  }

  const inicial = user?.displayName?.charAt(0).toUpperCase()
    ?? user?.email?.charAt(0).toUpperCase()
    ?? 'P'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
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

        {/* Status do produtor */}
        {produtor?.status === 'approved' ? (
          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={toggling}
            className={[
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
              produtor.isOpen
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
            ].join(' ')}
            aria-label={produtor.isOpen ? 'Fechar horta' : 'Abrir horta'}
          >
            <span
              className={[
                'h-2 w-2 shrink-0 rounded-full',
                produtor.isOpen ? 'bg-emerald-500' : 'bg-neutral-400',
              ].join(' ')}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {toggling ? 'Atualizando…' : produtor.isOpen ? 'Aberta — clique para fechar' : 'Fechada — clique para abrir'}
            </span>
            <span className="sm:hidden">
              {toggling ? '…' : produtor.isOpen ? 'Aberta' : 'Fechada'}
            </span>
          </button>
        ) : produtor?.status === 'pending' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="hidden sm:inline">Aguardando aprovação</span>
            <span className="sm:hidden">Pendente</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-neutral-300" aria-hidden="true" />
            <span className="hidden sm:inline">Produtor não configurado</span>
            <span className="sm:hidden">Configurar</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        {/* Notificações */}
        <NotificationBell />

        <div className="h-6 w-px bg-neutral-200" aria-hidden="true" />

        {/* Perfil */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
            aria-hidden="true"
          >
            {inicial}
          </div>
          <div className="hidden flex-col lg:flex">
            <span className="text-sm font-semibold leading-none text-neutral-900">
              {user?.displayName ?? 'Produtor'}
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
