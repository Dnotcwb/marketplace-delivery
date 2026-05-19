'use client'

import { useAuth } from '@marketplace/shared-services'
import { toggleProdutorOpen } from '@marketplace/shared-services'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

export default function Topbar() {
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
    <header className="flex h-16 items-center justify-between border-b border-neutral-200 bg-white px-6">
      {/* Status do produtor — toggle aberto/fechado */}
      <div className="flex items-center gap-3">
        {produtor?.status === 'approved' ? (
          <button
            type="button"
            onClick={handleToggleOpen}
            disabled={toggling}
            className={[
              'inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
              produtor.isOpen
                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200',
            ].join(' ')}
            aria-label={produtor.isOpen ? 'Fechar horta' : 'Abrir horta'}
          >
            <span
              className={[
                'h-2 w-2 rounded-full',
                produtor.isOpen ? 'bg-emerald-500' : 'bg-neutral-400',
              ].join(' ')}
              aria-hidden="true"
            />
            {toggling ? 'Atualizando…' : produtor.isOpen ? 'Aberta — clique para fechar' : 'Fechada — clique para abrir'}
          </button>
        ) : produtor?.status === 'pending' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            Aguardando aprovação
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-500">
            <span className="h-2 w-2 rounded-full bg-neutral-300" aria-hidden="true" />
            Produtor não configurado
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Notificações — Etapa 4 */}
        <button
          className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Notificações"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {/* Divisor */}
        <div className="h-6 w-px bg-neutral-200" aria-hidden="true" />

        {/* Perfil */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white"
            aria-hidden="true"
          >
            {inicial}
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold text-neutral-900 leading-none">
              {user?.displayName ?? 'Produtor'}
            </span>
            <span className="text-xs text-neutral-400 leading-none mt-0.5">{user?.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="ml-1 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-error"
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
