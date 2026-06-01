'use client'

import { useCartActions, useCartData } from '@marketplace/shared-services'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { formatCurrency } from '@marketplace/shared-utils'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect } from 'react'

export default function CartDrawer() {
  const { isOpen, items, horta, subtotalInCents } = useCartData()
  const { closeCart, removeItem, updateQuantity } = useCartActions()

  // Fecha com Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeCart])

  // Bloqueia scroll do body quando aberto
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const deliveryFee = horta?.deliveryFeeInCents ?? 0
  const total = subtotalInCents + deliveryFee
  const belowMinimum =
    horta && subtotalInCents < horta.minOrderValueInCents

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Carrinho de compras"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Meu carrinho</h2>
            {horta && (
              <p className="text-xs text-neutral-500">{horta.name}</p>
            )}
          </div>
          <button
            onClick={closeCart}
            className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Fechar carrinho"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="text-5xl">🛒</span>
              <p className="text-sm text-neutral-500">Seu carrinho está vazio.</p>
              <button
                onClick={closeCart}
                className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Continuar explorando
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(({ product, quantity }) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50 p-3"
                >
                  {/* Foto */}
                  <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-200">
                    {product.photoUrl ? (
                      <Image
                        src={product.photoUrl}
                        alt={product.name}
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">🥬</div>
                    )}
                  </div>

                  {/* Info + controles */}
                  <div className="flex-1 overflow-hidden">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {formatCurrency(product.priceInCents)}/{PRODUCT_UNIT_LABELS[product.unit]}
                    </p>
                    <p className="text-xs font-bold text-brand-600">
                      {formatCurrency(product.priceInCents * quantity)}
                    </p>

                    {/* Quantidade */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                        aria-label="Diminuir quantidade"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="min-w-[1.25rem] text-center text-sm font-semibold">
                        {quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                        aria-label="Aumentar quantidade"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>

                      <button
                        onClick={() => removeItem(product.id)}
                        className="ml-auto text-xs text-red-400 hover:text-red-600"
                        aria-label={`Remover ${product.name}`}
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Rodapé com totais e botão */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 px-5 py-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalInCents)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Entrega</span>
                <span>
                  {deliveryFee === 0 ? (
                    <span className="font-medium text-emerald-600">Grátis</span>
                  ) : (
                    formatCurrency(deliveryFee)
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-bold text-neutral-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>

            {belowMinimum && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Pedido mínimo: {formatCurrency(horta!.minOrderValueInCents)}. Faltam{' '}
                {formatCurrency(horta!.minOrderValueInCents - subtotalInCents)}.
              </p>
            )}

            <Link
              href="/checkout"
              onClick={closeCart}
              className={[
                'flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold text-white transition-colors',
                belowMinimum
                  ? 'pointer-events-none bg-neutral-300'
                  : 'bg-brand-500 hover:bg-brand-600',
              ].join(' ')}
              aria-disabled={belowMinimum ?? undefined}
            >
              Ir para o checkout →
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
