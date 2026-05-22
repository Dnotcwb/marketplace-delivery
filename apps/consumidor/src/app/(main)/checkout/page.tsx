'use client'

import { firestore, functions } from '@marketplace/shared-firebase'
import {
  createAddress,
  listAddresses,
  useAuth,
  useCart,
} from '@marketplace/shared-services'
import type { Address } from '@marketplace/shared-types'
import { PRODUCT_UNIT_LABELS } from '@marketplace/shared-types'
import { calcDeliveryFee, formatCurrency, geocodeCep } from '@marketplace/shared-utils'
import { doc, onSnapshot } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

// ──────────────────────────────────────────────────────
//  Tipos do retorno da Cloud Function
// ──────────────────────────────────────────────────────

interface CreateOrderResult {
  orderId: string
  paymentMethod: 'pix' | 'credit_card'
  pixQrCode?: string
  pixQrCodeBase64?: string
  mpPreferenceUrl?: string
  total: number
  devMode?: boolean
}

// ──────────────────────────────────────────────────────
//  Componente de endereço em branco
// ──────────────────────────────────────────────────────

const blankAddress = {
  label: 'Casa',
  recipientName: '',
  phone: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  isDefault: false,
}

type AddressForm = typeof blankAddress

// ──────────────────────────────────────────────────────
//  Helpers
// ──────────────────────────────────────────────────────

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

async function fetchViaCep(cep: string): Promise<Partial<AddressForm> | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return null
    const data = await res.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string }
    if (data.erro) return null
    return {
      street: data.logradouro ?? '',
      neighborhood: data.bairro ?? '',
      city: data.localidade ?? '',
      state: data.uf ?? '',
    }
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────
//  Página principal
// ──────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { items, horta, subtotalInCents, clearCart } = useCart()

  // Endereços
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [addressForm, setAddressForm] = useState<AddressForm>(blankAddress)
  const [cepLoading, setCepLoading] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)

  // Frete dinâmico
  const [dynamicFeeInCents, setDynamicFeeInCents] = useState<number | null>(null)
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number | undefined>(undefined)
  const [feeOutOfRange, setFeeOutOfRange] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodingFailed, setGeocodingFailed] = useState(false)

  // Pagamento
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card'>('pix')
  const [couponCode, setCouponCode] = useState('')

  // Envio
  const [pageState, setPageState] = useState<'form' | 'submitting' | 'pix' | 'done'>('form')
  const [orderResult, setOrderResult] = useState<CreateOrderResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // PIX copy
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Redireciona para home se carrinho vazio — mas não depois de submeter o pedido
  useEffect(() => {
    if (!authLoading && !items.length && pageState === 'form') {
      router.replace('/')
    }
  }, [authLoading, items.length, pageState, router])

  // Redireciona para login se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Carrega endereços do usuário
  useEffect(() => {
    if (!user) return
    listAddresses(user.uid).then((list) => {
      setAddresses(list)
      const def = list.find((a) => a.isDefault)
      if (def) setSelectedAddressId(def.id)
      else if (list.length > 0) setSelectedAddressId(list[0]!.id)
      else setShowNewAddress(true)
    })
  }, [user])

  // Geocodifica o CEP do endereço selecionado para cálculo de frete dinâmico
  useEffect(() => {
    if (!selectedAddressId || !horta?.deliveryFeePerKmInCents || !horta.lat || !horta.lng) {
      setDynamicFeeInCents(null)
      setDeliveryDistanceKm(undefined)
      setFeeOutOfRange(false)
      setGeocodingFailed(false)
      return
    }
    const addr = addresses.find((a) => a.id === selectedAddressId)
    if (!addr) return
    let cancelled = false
    setGeocoding(true)
    setGeocodingFailed(false)
    geocodeCep(addr.cep).then((coords) => {
      if (cancelled) return
      if (!coords) {
        // Geocodificação falhou — mantém taxa fixa e avisa o usuário
        setGeocodingFailed(true)
        setDynamicFeeInCents(null)
        setDeliveryDistanceKm(undefined)
        setFeeOutOfRange(false)
        setGeocoding(false)
        return
      }
      const result = calcDeliveryFee(horta, coords.lat, coords.lng)
      setDynamicFeeInCents(result.feeInCents)
      setDeliveryDistanceKm(result.distanceKm)
      setFeeOutOfRange(result.outOfRange ?? false)
      setGeocodingFailed(false)
      setGeocoding(false)
    })
    return () => { cancelled = true }
  }, [selectedAddressId, addresses, horta])

  // Ouve mudança no status do pedido (PIX → confirma quando pago)
  useEffect(() => {
    if (pageState !== 'pix' || !orderResult?.orderId) return

    const unsub = onSnapshot(doc(firestore, 'orders', orderResult.orderId), (snap) => {
      const data = snap.data()
      if (data?.['status'] === 'confirmed') {
        clearCart()
        router.replace(`/pedido/${orderResult.orderId}`)
      }
    })
    return unsub
  }, [pageState, orderResult, clearCart, router])

  if (authLoading || !user || !horta) return null

  const deliveryFeeInCents = dynamicFeeInCents ?? horta.deliveryFeeInCents
  const totalInCents = subtotalInCents + deliveryFeeInCents

  // ── CEP lookup ──────────────────────────────────────

  async function handleCepBlur() {
    setCepLoading(true)
    const result = await fetchViaCep(addressForm.cep)
    if (result) {
      setAddressForm((prev) => ({ ...prev, ...result }))
    }
    setCepLoading(false)
  }

  // ── Salvar novo endereço ────────────────────────────

  async function handleSaveAddress() {
    if (!user) return
    const { label, recipientName, phone, cep, street, number, neighborhood, city, state } = addressForm
    if (!label || !recipientName || !phone || !cep || !street || !number || !neighborhood || !city || !state) {
      setError('Preencha todos os campos obrigatórios do endereço.')
      return
    }
    setSavingAddress(true)
    setError(null)
    try {
      const id = await createAddress(user.uid, {
        label,
        recipientName,
        phone,
        cep: cep.replace(/\D/g, ''),
        street,
        number,
        complement: addressForm.complement || undefined,
        neighborhood,
        city,
        state,
        isDefault: addresses.length === 0,
      })
      const newAddress: Address = {
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
        isDefault: addresses.length === 0,
        createdAt: null as unknown as import('firebase/firestore').Timestamp,
        updatedAt: null as unknown as import('firebase/firestore').Timestamp,
        ...(addressForm.complement ? { complement: addressForm.complement } : {}),
      }
      setAddresses((prev) => [...prev, newAddress])
      setSelectedAddressId(id)
      setShowNewAddress(false)
      setAddressForm(blankAddress)
    } catch {
      setError('Erro ao salvar endereço. Tente novamente.')
    } finally {
      setSavingAddress(false)
    }
  }

  // ── Submeter pedido ─────────────────────────────────

  async function handleSubmit() {
    if (!selectedAddressId && !showNewAddress) {
      setError('Selecione um endereço de entrega.')
      return
    }
    setError(null)
    setPageState('submitting')

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
    if (!selectedAddress) {
      setError('Selecione ou cadastre um endereço de entrega.')
      setPageState('form')
      return
    }

    const deliveryAddress = {
      label: selectedAddress.label,
      recipientName: selectedAddress.recipientName,
      phone: selectedAddress.phone,
      cep: selectedAddress.cep,
      street: selectedAddress.street,
      number: selectedAddress.number,
      neighborhood: selectedAddress.neighborhood,
      city: selectedAddress.city,
      state: selectedAddress.state,
      ...(selectedAddress.complement ? { complement: selectedAddress.complement } : {}),
    }

    if (!horta) {
      setPageState('form')
      return
    }

    const createOrderFn = httpsCallable<unknown, CreateOrderResult>(functions, 'createOrder')

    try {
      const res = await createOrderFn({
        hortaId: horta.id,
        items: items.map(({ product, produtorId, quantity, notes }) => ({
          produtorId,
          productId: product.id,
          quantity,
          ...(notes ? { notes } : {}),
        })),
        deliveryAddress,
        paymentMethod,
        ...(couponCode.trim() ? { couponCode: couponCode.trim() } : {}),
      })

      const result = res.data
      setOrderResult(result)

      if (result.devMode) {
        // Sem MP configurado — vai direto para tracking (sem pagamento real)
        router.replace(`/pedido/${result.orderId}`)
        clearCart()
        return
      }

      if (paymentMethod === 'pix') {
        setPageState('pix')
      } else if (result.mpPreferenceUrl) {
        clearCart()
        window.location.href = result.mpPreferenceUrl
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar pedido.'
      setError(msg.replace('Error: ', ''))
      setPageState('form')
    }
  }

  // ── Copiar código PIX ────────────────────────────────

  function handleCopyPix() {
    if (!orderResult?.pixQrCode) return
    navigator.clipboard.writeText(orderResult.pixQrCode).then(() => {
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 3000)
    })
  }

  // ═══════════════════════════════════════════════════
  //  Tela PIX (após criar pedido)
  // ═══════════════════════════════════════════════════

  if (pageState === 'pix' && orderResult) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm text-center">
          <div className="mb-2 text-4xl">📱</div>
          <h1 className="mb-1 text-xl font-bold text-neutral-900">Pague com PIX</h1>
          <p className="mb-6 text-sm text-neutral-500">
            Escaneie o QR Code ou copie o código abaixo. O pedido é confirmado automaticamente.
          </p>

          {orderResult.pixQrCodeBase64 ? (
            <div className="mb-5 flex justify-center">
              <Image
                src={`data:image/png;base64,${orderResult.pixQrCodeBase64}`}
                alt="QR Code PIX"
                width={220}
                height={220}
                className="rounded-xl"
                unoptimized
              />
            </div>
          ) : (
            <div className="mb-5 flex h-56 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400 text-sm">
              QR Code indisponível
            </div>
          )}

          <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-left">
            <p className="mb-1 text-xs font-medium text-neutral-500">Código PIX copia e cola</p>
            <p className="break-all text-xs text-neutral-700 font-mono leading-relaxed">
              {orderResult.pixQrCode ?? '—'}
            </p>
          </div>

          <button
            onClick={handleCopyPix}
            className="mb-4 w-full rounded-xl bg-brand-500 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-600"
          >
            {copied ? '✓ Copiado!' : 'Copiar código PIX'}
          </button>

          <p className="mb-6 text-xs text-neutral-400">
            Total: {formatCurrency(orderResult.total)} · Pedido #{orderResult.orderId.slice(0, 8)}
          </p>

          <button
            onClick={() => {
              clearCart()
              router.replace(`/pedido/${orderResult.orderId}`)
            }}
            className="w-full rounded-xl border border-neutral-300 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-50"
          >
            Acompanhar pedido →
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  //  Formulário principal
  // ═══════════════════════════════════════════════════

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-neutral-900">Checkout</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── Coluna esquerda (formulários) ────────── */}
        <div className="space-y-5 lg:col-span-7">

          {/* Endereço de entrega */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-neutral-900">Endereço de entrega</h2>

            {/* Lista de endereços */}
            {addresses.length > 0 && (
              <div className="mb-4 space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={[
                      'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors',
                      selectedAddressId === addr.id
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-neutral-200 hover:border-neutral-300',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="address"
                      value={addr.id}
                      checked={selectedAddressId === addr.id}
                      onChange={() => {
                        setSelectedAddressId(addr.id)
                        setShowNewAddress(false)
                      }}
                      className="mt-0.5 accent-brand-500"
                    />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold text-neutral-900">
                        {addr.label} — {addr.recipientName}
                      </p>
                      <p className="text-neutral-500">
                        {addr.street}, {addr.number}
                        {addr.complement ? `, ${addr.complement}` : ''} — {addr.neighborhood}
                      </p>
                      <p className="text-neutral-500">
                        {addr.city}/{addr.state} · CEP {addr.cep}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Botão / formulário de novo endereço */}
            {!showNewAddress ? (
              <button
                type="button"
                onClick={() => setShowNewAddress(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 py-3 text-sm font-medium text-neutral-500 transition-colors hover:border-brand-400 hover:text-brand-600"
              >
                + Adicionar novo endereço
              </button>
            ) : (
              <div className="mt-2 space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                <h3 className="text-sm font-semibold text-neutral-900">Novo endereço</h3>

                {/* Label */}
                <div className="flex gap-2">
                  {['Casa', 'Trabalho', 'Outro'].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setAddressForm((p) => ({ ...p, label: lbl }))}
                      className={[
                        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                        addressForm.label === lbl
                          ? 'bg-brand-500 text-white'
                          : 'border border-neutral-300 text-neutral-600 hover:border-brand-400',
                      ].join(' ')}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                {/* Nome do destinatário */}
                <Field label="Nome do destinatário *">
                  <input
                    type="text"
                    value={addressForm.recipientName}
                    onChange={(e) => setAddressForm((p) => ({ ...p, recipientName: e.target.value }))}
                    placeholder="Ex: João Silva"
                    className={inputCls}
                  />
                </Field>

                {/* Telefone */}
                <Field label="Telefone *">
                  <input
                    type="tel"
                    value={addressForm.phone}
                    onChange={(e) => setAddressForm((p) => ({ ...p, phone: maskPhone(e.target.value) }))}
                    placeholder="(11) 99999-9999"
                    className={inputCls}
                  />
                </Field>

                {/* CEP */}
                <Field label="CEP *">
                  <div className="relative">
                    <input
                      type="text"
                      value={addressForm.cep}
                      onChange={(e) => setAddressForm((p) => ({ ...p, cep: maskCep(e.target.value) }))}
                      onBlur={handleCepBlur}
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

                {/* Rua e número */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Rua *">
                      <input
                        type="text"
                        value={addressForm.street}
                        onChange={(e) => setAddressForm((p) => ({ ...p, street: e.target.value }))}
                        placeholder="Nome da rua"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="Número *">
                    <input
                      type="text"
                      value={addressForm.number}
                      onChange={(e) => setAddressForm((p) => ({ ...p, number: e.target.value }))}
                      placeholder="123"
                      className={inputCls}
                    />
                  </Field>
                </div>

                {/* Complemento */}
                <Field label="Complemento">
                  <input
                    type="text"
                    value={addressForm.complement}
                    onChange={(e) => setAddressForm((p) => ({ ...p, complement: e.target.value }))}
                    placeholder="Apto, bloco, etc."
                    className={inputCls}
                  />
                </Field>

                {/* Bairro, cidade, estado */}
                <Field label="Bairro *">
                  <input
                    type="text"
                    value={addressForm.neighborhood}
                    onChange={(e) => setAddressForm((p) => ({ ...p, neighborhood: e.target.value }))}
                    placeholder="Bairro"
                    className={inputCls}
                  />
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Field label="Cidade *">
                      <input
                        type="text"
                        value={addressForm.city}
                        onChange={(e) => setAddressForm((p) => ({ ...p, city: e.target.value }))}
                        placeholder="Cidade"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field label="UF *">
                    <input
                      type="text"
                      value={addressForm.state}
                      onChange={(e) => setAddressForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))}
                      placeholder="SP"
                      maxLength={2}
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowNewAddress(false); setAddressForm(blankAddress) }}
                    className="flex-1 rounded-xl border border-neutral-300 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAddress}
                    disabled={savingAddress}
                    className="flex-1 rounded-xl bg-brand-500 py-2 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"
                  >
                    {savingAddress ? 'Salvando…' : 'Salvar endereço'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Forma de pagamento */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-4 text-base font-bold text-neutral-900">Forma de pagamento</h2>

            <div className="space-y-2">
              <PaymentOption
                value="pix"
                selected={paymentMethod === 'pix'}
                onSelect={() => setPaymentMethod('pix')}
                icon="⚡"
                title="PIX"
                subtitle="Aprovação imediata"
              />
              <PaymentOption
                value="credit_card"
                selected={paymentMethod === 'credit_card'}
                onSelect={() => setPaymentMethod('credit_card')}
                icon="💳"
                title="Cartão de crédito"
                subtitle="Redirecionado para Mercado Pago"
              />
            </div>
          </section>

          {/* Cupom */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-5">
            <h2 className="mb-3 text-base font-bold text-neutral-900">Cupom de desconto</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Digite o código"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
              >
                Aplicar
              </button>
            </div>
          </section>
        </div>

        {/* ── Coluna direita (resumo) ───────────────── */}
        <div className="lg:col-span-5">
          <div className="sticky top-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-neutral-900">Resumo do pedido</h2>

            {/* Horta */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              {horta.name}
            </p>

            {/* Itens */}
            <ul className="mb-4 space-y-2">
              {items.map(({ product, quantity }) => (
                <li key={product.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex-1 truncate text-neutral-700">
                    {quantity} {PRODUCT_UNIT_LABELS[product.unit]} {product.name}
                  </span>
                  <span className="font-semibold text-neutral-900">
                    {formatCurrency(product.priceInCents * quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {/* Totais */}
            <div className="space-y-1.5 border-t border-neutral-100 pt-3 text-sm">
              <div className="flex justify-between text-neutral-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotalInCents)}</span>
              </div>
              <div className="flex justify-between text-neutral-500">
                <span className="flex items-center gap-1">
                  Entrega
                  {!geocoding && deliveryDistanceKm !== undefined && (
                    <span className="text-xs text-neutral-400">
                      · {deliveryDistanceKm.toFixed(1)} km
                    </span>
                  )}
                </span>
                <span>
                  {geocoding ? (
                    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
                  ) : feeOutOfRange ? (
                    <span className="font-medium text-red-500">Fora do raio</span>
                  ) : deliveryFeeInCents === 0 ? (
                    <span className="font-medium text-emerald-600">Grátis</span>
                  ) : (
                    formatCurrency(deliveryFeeInCents)
                  )}
                </span>
              </div>
              {geocodingFailed && (
                <p className="text-xs text-amber-600">
                  Não foi possível calcular a distância — usando taxa fixa.
                </p>
              )}
              <div className="flex justify-between border-t border-neutral-100 pt-2 font-bold text-neutral-900">
                <span>Total</span>
                <span>{formatCurrency(totalInCents)}</span>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}

            {/* Botão */}
            {feeOutOfRange && (
              <div className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">
                Seu endereço está fora da área de entrega desta horta.
              </div>
            )}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pageState === 'submitting' || !selectedAddressId || feeOutOfRange || geocoding}
              className="mt-5 w-full rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pageState === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processando…
                </span>
              ) : (
                `Fazer pedido · ${formatCurrency(totalInCents)}`
              )}
            </button>

            <p className="mt-3 text-center text-xs text-neutral-400">
              Pagamento processado com segurança via Mercado Pago
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────
//  Componentes auxiliares
// ──────────────────────────────────────────────────────

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

function PaymentOption({
  value,
  selected,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  value: string
  selected: boolean
  onSelect: () => void
  icon: string
  title: string
  subtitle: string
}) {
  return (
    <label
      className={[
        'flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors',
        selected ? 'border-brand-500 bg-brand-50' : 'border-neutral-200 hover:border-neutral-300',
      ].join(' ')}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="accent-brand-500"
      />
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </label>
  )
}
