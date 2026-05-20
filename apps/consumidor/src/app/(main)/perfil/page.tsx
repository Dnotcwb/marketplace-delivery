'use client'

import { useAuth, listAddresses, deleteAddress } from '@marketplace/shared-services'
import type { Address } from '@marketplace/shared-types'
import { updateProfile } from 'firebase/auth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PerfilPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addrLoading, setAddrLoading] = useState(true)

  // Edição do nome
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameStatus, setNameStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  // Redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

  // Carrega endereços
  useEffect(() => {
    if (!user) return
    listAddresses(user.uid)
      .then(setAddresses)
      .catch((err) => console.error('listAddresses error:', err))
      .finally(() => setAddrLoading(false))
  }, [user])

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const inicial = user.displayName?.charAt(0).toUpperCase()
    ?? user.email?.charAt(0).toUpperCase()
    ?? 'U'

  async function saveName() {
    if (!nameInput.trim() || !user) return
    setSavingName(true)
    try {
      await updateProfile(user!, { displayName: nameInput.trim() })
      setEditingName(false)
      setNameStatus('ok')
      setTimeout(() => setNameStatus('idle'), 3000)
    } catch {
      setNameStatus('err')
    } finally {
      setSavingName(false)
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!window.confirm('Remover este endereço?')) return
    try {
      await deleteAddress(user!.uid, id)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      console.error('deleteAddress error:', err)
    }
  }

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-neutral-900">Meu perfil</h1>

      {/* Dados do usuário */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-500 text-2xl font-bold text-white">
            {inicial}
          </div>
          <div>
            <p className="font-bold text-neutral-900">{user.displayName ?? 'Sem nome'}</p>
            <p className="text-sm text-neutral-500">{user.email}</p>
          </div>
        </div>

        {/* Editar nome */}
        {editingName ? (
          <div className="flex gap-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveName()}
              placeholder="Seu nome completo"
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
            <button
              onClick={saveName}
              disabled={savingName}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {savingName ? '…' : 'Salvar'}
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              {nameStatus === 'ok' && <p className="text-sm text-emerald-600">Nome atualizado!</p>}
              {nameStatus === 'err' && <p className="text-sm text-red-500">Erro ao atualizar nome.</p>}
            </div>
            <button
              onClick={() => { setNameInput(user.displayName ?? ''); setEditingName(true) }}
              className="text-sm text-brand-500 hover:underline"
            >
              Editar nome
            </button>
          </div>
        )}
      </section>

      {/* Atalhos */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-neutral-700">Atalhos</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/pedidos"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:border-brand-400 hover:text-brand-600"
          >
            Meus pedidos
          </Link>
        </div>
      </section>

      {/* Endereços */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-bold text-neutral-700">Endereços cadastrados</h2>
        </div>

        {addrLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : addresses.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-neutral-400">Nenhum endereço cadastrado.</p>
            <p className="mt-1 text-xs text-neutral-400">Seus endereços são salvos ao finalizar um pedido.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {addresses.map((addr) => (
              <li key={addr.id} className="flex items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-neutral-900">{addr.label}</p>
                    {addr.isDefault && (
                      <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                        Padrão
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-neutral-500 truncate">
                    {addr.street}, {addr.number}
                    {addr.complement ? `, ${addr.complement}` : ''} — {addr.neighborhood}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {addr.city}/{addr.state} · CEP {addr.cep}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteAddress(addr.id)}
                  className="shrink-0 text-xs text-red-500 hover:underline"
                >
                  Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Sair */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <button
          onClick={handleLogout}
          className="w-full rounded-lg border border-red-200 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          Sair da conta
        </button>
      </section>
    </div>
  )
}
