'use client'

import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  subscribeToCategories,
  subscribeToProducts,
  toggleProductAvailable,
  updateCategory,
  updateProduct,
} from '@marketplace/shared-services'
import type { Category, Product, ProductUnit } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

// ── Modal de categoria ────────────────────────────────────────────────────────

interface CategoryModalProps {
  produtorId: string
  editing: Category | null
  onClose: () => void
}

function CategoryModal({ produtorId, editing, onClose }: CategoryModalProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await updateCategory(produtorId, editing.id, { name: name.trim() })
      } else {
        await createCategory(produtorId, { name: name.trim(), active: true, order: 0 })
      }
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          {editing ? 'Editar categoria' : 'Nova categoria'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Nome da categoria
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Folhosas, Legumes, Temperos…"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de produto ──────────────────────────────────────────────────────────

interface ProductModalProps {
  produtorId: string
  categories: Category[]
  editing: Product | null
  onClose: () => void
}

const UNITS: ProductUnit[] = ['kg', 'g', 'unidade', 'maco', 'duzia', 'litro', 'ml', 'caixa', 'bandeja', 'pote']

function ProductModal({ produtorId, categories, editing, onClose }: ProductModalProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [priceStr, setPriceStr] = useState(
    editing ? (editing.priceInCents / 100).toFixed(2).replace('.', ',') : '',
  )
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? categories[0]?.id ?? '')
  const [unit, setUnit] = useState<ProductUnit>(editing?.unit ?? 'unidade')
  const [isOrganic, setIsOrganic] = useState(editing?.isOrganic ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function priceInCents(): number {
    const num = parseFloat(priceStr.replace(',', '.'))
    return Math.round((isNaN(num) ? 0 : num) * 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome obrigatório'); return }
    if (!categoryId) { setError('Selecione uma categoria'); return }
    if (priceInCents() <= 0) { setError('Preço inválido'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        priceInCents: priceInCents(),
        categoryId,
        unit,
        isOrganic,
        available: editing?.available ?? true,
        order: editing?.order ?? 0,
      }
      if (editing) {
        await updateProduct(produtorId, editing.id, payload)
      } else {
        await createProduct(produtorId, payload)
      }
      onClose()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-bold text-neutral-900">
          {editing ? 'Editar produto' : 'Novo produto'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Nome *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Alface Crespa, Rúcula, Manjericão…"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Detalhes do produto, unidade de medida…"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Preço (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">
                  R$
                </span>
                <input
                  value={priceStr}
                  onChange={(e) => setPriceStr(e.target.value)}
                  placeholder="0,00"
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Unidade *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as ProductUnit)}
                className={inputCls}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{PRODUCT_UNIT_LABELS[u]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">
              Categoria *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputCls}
            >
              <option value="">Selecione…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isOrganic}
              onChange={(e) => setIsOrganic(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-brand-600"
            />
            <span className="text-sm text-neutral-700">Produto orgânico</span>
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function CatalogoPage() {
  const { produtor, loading: produtorLoading } = useProdutorAtivo()
  const [categories, setCategories] = useState<Category[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  const [catModal, setCatModal] = useState<{ open: boolean; editing: Category | null }>({
    open: false,
    editing: null,
  })
  const [prodModal, setProdModal] = useState<{ open: boolean; editing: Product | null }>({
    open: false,
    editing: null,
  })

  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!produtor) return
    const unsub = subscribeToCategories(produtor.id, (cats) => {
      setCategories(cats)
      setActiveCategoryId((prev) => prev ?? cats[0]?.id ?? null)
    })
    return unsub
  }, [produtor?.id])

  useEffect(() => {
    if (!produtor) return
    const unsub = subscribeToProducts(produtor.id, setAllProducts)
    return unsub
  }, [produtor?.id])

  const products = allProducts.filter((p) => p.categoryId === activeCategoryId)

  async function handleDeleteCategory(id: string) {
    if (!produtor) return
    setDeletingId(id)
    try {
      await deleteCategory(produtor.id, id)
      setActiveCategoryId((prev) => (prev === id ? null : prev))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteProduct(id: string) {
    if (!produtor) return
    setDeletingId(id)
    try {
      await deleteProduct(produtor.id, id)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleToggleProduct(product: Product) {
    if (!produtor) return
    await toggleProductAvailable(produtor.id, product.id, !product.available)
  }

  if (produtorLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!produtor || produtor.status !== 'approved') {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="text-neutral-500">
          Seu perfil precisa estar aprovado para gerenciar o catálogo.
        </p>
      </div>
    )
  }

  return (
    <>
      {catModal.open && (
        <CategoryModal
          produtorId={produtor.id}
          editing={catModal.editing}
          onClose={() => setCatModal({ open: false, editing: null })}
        />
      )}

      {prodModal.open && (
        <ProductModal
          produtorId={produtor.id}
          categories={categories}
          editing={prodModal.editing}
          onClose={() => setProdModal({ open: false, editing: null })}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {/* ── Coluna de categorias ── */}
        <aside className="sm:w-56 sm:flex-shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">Categorias</h2>
            <button
              onClick={() => setCatModal({ open: true, editing: null })}
              className="rounded-lg p-1 text-brand-600 hover:bg-brand-50"
              aria-label="Nova categoria"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <ul className="flex gap-2 overflow-x-auto pb-1 sm:block sm:space-y-1 sm:overflow-visible sm:pb-0">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className={[
                  'group flex-shrink-0 flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors sm:flex-shrink',
                  activeCategoryId === cat.id
                    ? 'bg-brand-500 text-white'
                    : 'text-neutral-700 hover:bg-neutral-100',
                ].join(' ')}
                onClick={() => setActiveCategoryId(cat.id)}
              >
                <span className="flex-1 truncate font-medium">{cat.name}</span>
                <div className="ml-1 hidden items-center gap-1 group-hover:flex">
                  <button
                    onClick={(e) => { e.stopPropagation(); setCatModal({ open: true, editing: cat }) }}
                    className={[
                      'rounded p-0.5 transition-colors',
                      activeCategoryId === cat.id
                        ? 'text-white/70 hover:text-white'
                        : 'text-neutral-400 hover:text-neutral-700',
                    ].join(' ')}
                    aria-label="Editar categoria"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id) }}
                    disabled={deletingId === cat.id}
                    className={[
                      'rounded p-0.5 transition-colors disabled:opacity-40',
                      activeCategoryId === cat.id
                        ? 'text-white/70 hover:text-red-200'
                        : 'text-neutral-400 hover:text-red-500',
                    ].join(' ')}
                    aria-label="Excluir categoria"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}

            {categories.length === 0 && (
              <li className="rounded-lg border border-dashed border-neutral-300 px-3 py-4 text-center text-xs text-neutral-400">
                Nenhuma categoria ainda.
                <br />
                Crie a primeira acima.
              </li>
            )}
          </ul>
        </aside>

        {/* ── Área de produtos ── */}
        <div className="flex-1 min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-700">
              {activeCategoryId
                ? `Produtos — ${categories.find((c) => c.id === activeCategoryId)?.name ?? ''}`
                : 'Selecione uma categoria'}
            </h2>
            {activeCategoryId && (
              <button
                onClick={() => setProdModal({ open: true, editing: null })}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo produto
              </button>
            )}
          </div>

          {!activeCategoryId ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400">
              Selecione ou crie uma categoria para ver os produtos.
            </div>
          ) : products.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 text-sm text-neutral-400">
              <span>Nenhum produto nesta categoria.</span>
              <button
                onClick={() => setProdModal({ open: true, editing: null })}
                className="text-brand-600 hover:underline"
              >
                Adicionar produto
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => (
                <div
                  key={product.id}
                  className={[
                    'flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition-colors',
                    product.available ? 'border-neutral-200' : 'border-neutral-100 opacity-60',
                  ].join(' ')}
                >
                  {/* Foto */}
                  <div className="h-12 w-12 sm:h-14 sm:w-14 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                    {product.photoUrl ? (
                      <Image
                        src={product.photoUrl}
                        alt={product.name}
                        width={48}
                        height={48}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-neutral-300">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">{product.name}</p>
                      {product.isOrganic && (
                        <span className="hidden sm:inline shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          Orgânico
                        </span>
                      )}
                    </div>
                    {product.description && (
                      <p className="truncate text-xs text-neutral-500">{product.description}</p>
                    )}
                    <p className="mt-0.5 text-sm font-bold text-brand-600">
                      {(product.priceInCents / 100).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                      <span className="ml-1 text-xs font-normal text-neutral-400">
                        / {PRODUCT_UNIT_LABELS[product.unit]}
                      </span>
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={product.available}
                      aria-label={product.available ? 'Desativar produto' : 'Ativar produto'}
                      onClick={() => handleToggleProduct(product)}
                      className={[
                        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full transition-colors',
                        product.available ? 'bg-brand-500' : 'bg-neutral-300',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'mt-0.5 inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                          product.available ? 'translate-x-4' : 'translate-x-0.5',
                        ].join(' ')}
                      />
                    </button>

                    <button
                      onClick={() => setProdModal({ open: true, editing: product })}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label="Editar produto"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      disabled={deletingId === product.id}
                      className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                      aria-label="Excluir produto"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
