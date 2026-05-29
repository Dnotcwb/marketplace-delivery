'use client'

import { useAuth, listAddresses, createAddress, updateAddress, deleteAddress } from '@marketplace/shared-services'
import type { Address } from '@marketplace/shared-types'
import { updateProfile } from 'firebase/auth'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

// ──────────────────────────────────────────────────────
//  Helpers / tipos locais
// ──────────────────────────────────────────────────────

const blankForm = {
  label: 'Casa',
  recipientName: '',
  phone: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  reference: '',
  neighborhood: '',
  city: '',
  state: '',
  isDefault: false,
}

type AddrForm = typeof blankForm

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  )
}

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return `(${d}`
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

function maskCep(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

async function fetchViaCep(cep: string): Promise<Partial<AddrForm> | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    return { street: data.logradouro ?? '', neighborhood: data.bairro ?? '', city: data.localidade ?? '', state: data.uf ?? '' }
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────
//  Sub-componente: formulário de endereço
// ──────────────────────────────────────────────────────

function AddressFormPanel({
  title,
  form,
  setForm,
  saving,
  onSave,
  onCancel,
  showDefault,
}: {
  title: string
  form: AddrForm
  setForm: React.Dispatch<React.SetStateAction<AddrForm>>
  saving: boolean
  onSave: () => void
  onCancel: () => void
  showDefault: boolean
}) {
  const [cepLoading, setCepLoading] = useState(false)

  return (
    <div className="border-t border-neutral-100 px-5 py-4 space-y-3">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>

      {/* Label */}
      <div className="flex gap-2">
        {['Casa', 'Trabalho', 'Outro'].map((lbl) => (
          <button
            key={lbl}
            type="button"
            onClick={() => setForm((p) => ({ ...p, label: lbl }))}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              form.label === lbl
                ? 'bg-brand-500 text-white'
                : 'border border-neutral-300 text-neutral-600 hover:border-brand-400',
            ].join(' ')}
          >
            {lbl}
          </button>
        ))}
      </div>

      <Field label="Nome do destinatário *">
        <input type="text" value={form.recipientName} onChange={(e) => setForm((p) => ({ ...p, recipientName: e.target.value }))} placeholder="Ex: João Silva" className={inputCls} />
      </Field>

      <Field label="Telefone *">
        <input type="tel" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" className={inputCls} />
      </Field>

      <Field label="CEP *">
        <div className="relative">
          <input
            type="text"
            value={form.cep}
            onChange={(e) => setForm((p) => ({ ...p, cep: maskCep(e.target.value) }))}
            onBlur={async () => {
              setCepLoading(true)
              const r = await fetchViaCep(form.cep)
              if (r) setForm((p) => ({ ...p, ...r }))
              setCepLoading(false)
            }}
            placeholder="00000-000"
            maxLength={9}
            className={inputCls}
          />
          {cepLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            </div>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Rua *">
            <input type="text" value={form.street} onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))} placeholder="Nome da rua" className={inputCls} />
          </Field>
        </div>
        <Field label="Número *">
          <input type="text" value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} placeholder="123" className={inputCls} />
        </Field>
      </div>

      <Field label="Complemento">
        <input type="text" value={form.complement} onChange={(e) => setForm((p) => ({ ...p, complement: e.target.value }))} placeholder="Apto, bloco, etc." className={inputCls} />
      </Field>

      <Field label="Ponto de referência">
        <input type="text" value={form.reference} onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))} placeholder="Ex: próximo ao mercado" className={inputCls} />
      </Field>

      <Field label="Bairro *">
        <input type="text" value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))} placeholder="Bairro" className={inputCls} />
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="Cidade *">
            <input type="text" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} placeholder="Cidade" className={inputCls} />
          </Field>
        </div>
        <Field label="UF *">
          <input type="text" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" maxLength={2} className={inputCls} />
        </Field>
      </div>

      {showDefault && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
            className="accent-brand-500"
          />
          Definir como endereço padrão
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-neutral-300 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          Cancelar
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="flex-1 rounded-lg bg-brand-500 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function PerfilPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()

  const [addresses, setAddresses] = useState<Address[]>([])
  const [addrLoading, setAddrLoading] = useState(true)
  const [addrError, setAddrError] = useState('')

  // Edição do nome
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameStatus, setNameStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  // Novo endereço
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<AddrForm>(blankForm)
  const [savingAdd, setSavingAdd] = useState(false)

  // Editar endereço
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AddrForm>(blankForm)
  const [savingEdit, setSavingEdit] = useState(false)

  // Confirmar remoção
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login')
  }, [authLoading, user, router])

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

  async function handleSaveNewAddress() {
    if (!user) return
    const { label, recipientName, phone, cep, street, number, neighborhood, city, state } = addForm
    if (!label || !recipientName || !phone || !cep || !street || !number || !neighborhood || !city || !state) {
      setAddrError('Preencha todos os campos obrigatórios.')
      return
    }
    setSavingAdd(true)
    setAddrError('')
    try {
      const forceDefault = addresses.length === 0
      const shouldBeDefault = forceDefault || addForm.isDefault
      const id = await createAddress(user.uid, {
        label,
        recipientName,
        phone,
        cep: cep.replace(/\D/g, ''),
        street,
        number,
        complement: addForm.complement || undefined,
        reference: addForm.reference || undefined,
        neighborhood,
        city,
        state,
        isDefault: shouldBeDefault,
      })
      const newAddr: Address = {
        id,
        userId: user.uid,
        label,
        recipientName,
        phone,
        cep: cep.replace(/\D/g, ''),
        street,
        number,
        neighborhood,
        city,
        state,
        isDefault: shouldBeDefault,
        createdAt: null as unknown as import('firebase/firestore').Timestamp,
        updatedAt: null as unknown as import('firebase/firestore').Timestamp,
        ...(addForm.complement ? { complement: addForm.complement } : {}),
        ...(addForm.reference ? { reference: addForm.reference } : {}),
      }
      setAddresses((prev) => {
        const updated = shouldBeDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev
        return [newAddr, ...updated]
      })
      setShowAddForm(false)
      setAddForm(blankForm)
    } catch {
      setAddrError('Erro ao salvar endereço. Tente novamente.')
    } finally {
      setSavingAdd(false)
    }
  }

  function handleStartEdit(addr: Address) {
    setShowAddForm(false)
    setEditingAddressId(addr.id)
    setEditForm({
      label: addr.label,
      recipientName: addr.recipientName,
      phone: addr.phone,
      cep: addr.cep.length === 8 ? `${addr.cep.slice(0, 5)}-${addr.cep.slice(5)}` : addr.cep,
      street: addr.street,
      number: addr.number,
      complement: addr.complement ?? '',
      reference: addr.reference ?? '',
      neighborhood: addr.neighborhood,
      city: addr.city,
      state: addr.state,
      isDefault: addr.isDefault,
    })
  }

  async function handleUpdateAddress() {
    if (!user || !editingAddressId) return
    const { label, recipientName, phone, cep, street, number, neighborhood, city, state } = editForm
    if (!label || !recipientName || !phone || !cep || !street || !number || !neighborhood || !city || !state) {
      setAddrError('Preencha todos os campos obrigatórios.')
      return
    }
    setSavingEdit(true)
    setAddrError('')
    try {
      const data = {
        label,
        recipientName,
        phone,
        cep: cep.replace(/\D/g, ''),
        street,
        number,
        complement: editForm.complement || undefined,
        reference: editForm.reference || undefined,
        neighborhood,
        city,
        state,
        isDefault: editForm.isDefault,
      }
      await updateAddress(user.uid, editingAddressId, data)
      setAddresses((prev) =>
        prev.map((a) => {
          if (a.id !== editingAddressId) return editForm.isDefault ? { ...a, isDefault: false } : a
          return { ...a, ...data }
        }),
      )
      setEditingAddressId(null)
    } catch {
      setAddrError('Erro ao atualizar endereço. Tente novamente.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteAddress(id: string) {
    if (!user) return
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      await deleteAddress(user.uid, id)
      setAddresses((prev) => prev.filter((a) => a.id !== id))
      if (editingAddressId === id) setEditingAddressId(null)
    } catch {
      setAddrError('Não foi possível remover o endereço.')
    } finally {
      setDeletingId(null)
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
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
          <h2 className="text-sm font-bold text-neutral-700">Endereços cadastrados</h2>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => { setShowAddForm(true); setEditingAddressId(null); setAddForm(blankForm) }}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              + Adicionar
            </button>
          )}
        </div>

        {addrError && (
          <div className="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{addrError}</div>
        )}

        {addrLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {addresses.length === 0 && !showAddForm && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-neutral-400">Nenhum endereço cadastrado.</p>
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="mt-2 text-sm text-brand-500 hover:underline"
                >
                  Adicionar agora
                </button>
              </div>
            )}

            {addresses.length > 0 && (
              <ul className="divide-y divide-neutral-100">
                {addresses.map((addr) => (
                  <li key={addr.id}>
                    <div className="flex items-start justify-between gap-3 px-5 py-4">
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
                          {addr.recipientName} · {addr.street}, {addr.number}
                          {addr.complement ? `, ${addr.complement}` : ''} — {addr.neighborhood}
                        </p>
                        <p className="text-xs text-neutral-400">
                          {addr.city}/{addr.state} · CEP {addr.cep}
                        </p>
                        {addr.reference && (
                          <p className="text-xs text-neutral-400">Ref: {addr.reference}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => editingAddressId === addr.id ? setEditingAddressId(null) : handleStartEdit(addr)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          {editingAddressId === addr.id ? 'Fechar' : 'Editar'}
                        </button>
                        {confirmDeleteId === addr.id ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-neutral-500 hover:underline"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              disabled={deletingId === addr.id}
                              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                            >
                              {deletingId === addr.id ? '…' : 'Confirmar'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(addr.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    </div>

                    {editingAddressId === addr.id && (
                      <AddressFormPanel
                        title="Editar endereço"
                        form={editForm}
                        setForm={setEditForm}
                        saving={savingEdit}
                        onSave={handleUpdateAddress}
                        onCancel={() => setEditingAddressId(null)}
                        showDefault={!addr.isDefault}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {showAddForm && (
              <AddressFormPanel
                title="Novo endereço"
                form={addForm}
                setForm={setAddForm}
                saving={savingAdd}
                onSave={handleSaveNewAddress}
                onCancel={() => { setShowAddForm(false); setAddForm(blankForm); setAddrError('') }}
                showDefault={addresses.length > 0}
              />
            )}
          </>
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
