'use client'

import { updateHorta } from '@marketplace/shared-services'
import { useState, useEffect } from 'react'
import { useHorta } from '@/components/HortaGuard'

export default function MinhaHortaPage() {
  const { horta, hortaId } = useHorta()

  const [name, setName] = useState(horta.name)
  const [description, setDescription] = useState(horta.description ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(horta.status)
  const [street, setStreet] = useState(horta.address.street)
  const [number, setNumber] = useState(horta.address.number)
  const [neighborhood, setNeighborhood] = useState(horta.address.neighborhood)
  const [city, setCity] = useState(horta.address.city)
  const [state, setState] = useState(horta.address.state ?? '')
  const [cep, setCep] = useState(horta.address.cep ?? '')
  const [deliveryFee, setDeliveryFee] = useState(
    (horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ','),
  )
  const [minOrder, setMinOrder] = useState(
    (horta.minOrderValueInCents / 100).toFixed(2).replace('.', ','),
  )
  const [timeMin, setTimeMin] = useState(String(horta.estimatedDeliveryTimeMin))
  const [timeMax, setTimeMax] = useState(String(horta.estimatedDeliveryTimeMax))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Sincroniza campos se a horta mudar em tempo real
  useEffect(() => {
    setName(horta.name)
    setDescription(horta.description ?? '')
    setStatus(horta.status)
    setStreet(horta.address.street)
    setNumber(horta.address.number)
    setNeighborhood(horta.address.neighborhood)
    setCity(horta.address.city)
    setState(horta.address.state ?? '')
    setCep(horta.address.cep ?? '')
    setDeliveryFee((horta.deliveryFeeInCents / 100).toFixed(2).replace('.', ','))
    setMinOrder((horta.minOrderValueInCents / 100).toFixed(2).replace('.', ','))
    setTimeMin(String(horta.estimatedDeliveryTimeMin))
    setTimeMax(String(horta.estimatedDeliveryTimeMax))
  }, [horta.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  function parseCents(v: string) {
    return Math.round(parseFloat(v.replace(',', '.') || '0') * 100)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await updateHorta(hortaId, {
        name: name.trim(),
        description: description.trim(),
        status,
        address: { cep, street, number, neighborhood, city, state },
        deliveryFeeInCents: parseCents(deliveryFee),
        minOrderValueInCents: parseCents(minOrder),
        estimatedDeliveryTimeMin: parseInt(timeMin) || 30,
        estimatedDeliveryTimeMax: parseInt(timeMax) || 60,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'
  const labelCls = 'mb-1 block text-xs font-medium text-neutral-600'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Minha Horta</h1>
        <p className="text-sm text-neutral-500">Edite as informações da sua horta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informações básicas */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide">Informações básicas</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Nome da horta *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className={inputCls}
                >
                  <option value="active">Ativa — recebendo pedidos</option>
                  <option value="inactive">Inativa — pausada</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputCls} resize-none`}
                placeholder="Descreva a sua horta…"
              />
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide">Endereço</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>Rua / Avenida</label>
                <input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Número</label>
                <input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>CEP</label>
                <input value={cep} onChange={(e) => setCep(e.target.value)} className={inputCls} placeholder="00000-000" />
              </div>
              <div>
                <label className={labelCls}>Bairro</label>
                <input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cidade</label>
                <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="w-28">
              <label className={labelCls}>Estado</label>
              <input value={state} onChange={(e) => setState(e.target.value)} className={inputCls} placeholder="PR" maxLength={2} />
            </div>
          </div>
        </section>

        {/* Configurações de entrega */}
        <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-neutral-700 uppercase tracking-wide">Configurações de entrega</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={labelCls}>Taxa de entrega (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-neutral-400">R$</span>
                <input
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  className={`${inputCls} pl-8`}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Pedido mínimo (R$)</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-neutral-400">R$</span>
                <input
                  value={minOrder}
                  onChange={(e) => setMinOrder(e.target.value)}
                  className={`${inputCls} pl-8`}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Tempo mínimo (min)</label>
              <input type="number" min={1} value={timeMin} onChange={(e) => setTimeMin(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tempo máximo (min)</label>
              <input type="number" min={1} value={timeMax} onChange={(e) => setTimeMax(e.target.value)} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Feedback + botão */}
        <div className="flex items-center justify-between">
          <div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {saved && (
              <p className="text-sm text-emerald-600">
                Alterações salvas com sucesso!
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>
  )
}
