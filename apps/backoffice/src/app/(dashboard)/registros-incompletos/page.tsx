'use client'

import { callCleanupGhostProdutores, type GhostAccount } from '@marketplace/shared-services'
import { useCallback, useEffect, useState } from 'react'

export default function RegistrosIncompletosPage() {
  const [ghosts, setGhosts] = useState<GhostAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [emailInput, setEmailInput] = useState('')
  const [deletingAll, setDeletingAll] = useState(false)

  const listGhosts = useCallback(async () => {
    setLoading(true)
    try {
      const result = await callCleanupGhostProdutores({ dryRun: true, autoClean: true })
      setGhosts(result.found)
    } catch {
      setMsg({ type: 'err', text: 'Erro ao buscar registros incompletos.' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { listGhosts() }, [listGhosts])

  async function handleDeleteOne(email: string) {
    setActing(email)
    setMsg(null)
    try {
      await callCleanupGhostProdutores({ emails: [email] })
      setGhosts((prev) => prev.filter((g) => g.email !== email))
      setMsg({ type: 'ok', text: `Conta ${email} excluída.` })
    } catch {
      setMsg({ type: 'err', text: 'Erro ao excluir conta.' })
    } finally {
      setActing(null)
    }
  }

  async function handleDeleteAll() {
    if (!confirm(`Excluir ${ghosts.length} registro(s) incompleto(s) com mais de 1 hora? Esta ação é irreversível.`)) return
    setDeletingAll(true)
    setMsg(null)
    try {
      const result = await callCleanupGhostProdutores({ autoClean: true })
      setMsg({ type: 'ok', text: `${result.totalDeleted} conta(s) excluída(s).` })
      await listGhosts()
    } catch {
      setMsg({ type: 'err', text: 'Erro ao excluir em lote.' })
    } finally {
      setDeletingAll(false)
    }
  }

  async function handleDeleteByEmail(e: React.FormEvent) {
    e.preventDefault()
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    setActing(email)
    setMsg(null)
    try {
      const result = await callCleanupGhostProdutores({ emails: [email] })
      if (result.totalDeleted > 0) {
        setMsg({ type: 'ok', text: `Conta ${email} excluída com sucesso.` })
        setEmailInput('')
        await listGhosts()
      } else {
        setMsg({ type: 'err', text: `Conta não encontrada ou já possui cadastro completo.` })
      }
    } catch {
      setMsg({ type: 'err', text: 'Erro ao excluir conta.' })
    } finally {
      setActing(null)
    }
  }

  function formatDate(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  function timeAgo(iso: string) {
    if (!iso) return ''
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `há ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `há ${hrs}h`
    return `há ${Math.floor(hrs / 24)} dia(s)`
  }

  const inputCls = 'rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Registros Incompletos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Contas criadas no app produtor que não concluíram o cadastro.
          </p>
        </div>
        <button
          onClick={listGhosts}
          disabled={loading}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
        >
          Atualizar
        </button>
      </div>

      {/* Mensagem de feedback */}
      {msg && (
        <div className={[
          'rounded-lg px-4 py-3 text-sm font-medium',
          msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
        ].join(' ')}>
          {msg.text}
        </div>
      )}

      {/* Excluir por e-mail (para contas antigas sem marcador) */}
      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-neutral-800">Excluir conta por e-mail</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Para remover contas fantasma anteriores ao sistema de marcação (ex: elon@gmail.com, maria@gmail.com).
          Só funciona se a conta não tiver produtor cadastrado.
        </p>
        <form onSubmit={handleDeleteByEmail} className="flex gap-3">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="email@dominio.com"
            required
            className={`${inputCls} flex-1`}
          />
          <button
            type="submit"
            disabled={!!acting || !emailInput.trim()}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {acting && acting !== '' ? 'Excluindo…' : 'Excluir'}
          </button>
        </form>
      </section>

      {/* Lista de registros incompletos marcados */}
      <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-bold text-neutral-800">
            Cadastros incompletos detectados
            {!loading && (
              <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                {ghosts.length}
              </span>
            )}
          </h2>
          {ghosts.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={deletingAll || loading}
              className="rounded-lg bg-red-50 px-4 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
            >
              {deletingAll ? 'Limpando…' : `Limpar todos com +1h (${ghosts.length})`}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : ghosts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-neutral-700">Nenhum registro incompleto encontrado</p>
            <p className="mt-1 text-xs text-neutral-400">
              Apenas cadastros marcados com &ldquo;registrationSource: produtor&rdquo; aparecem aqui.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Nome</th>
                <th className="px-5 py-3">Iniciado em</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ghosts.map((g) => (
                <tr key={g.uid} className="hover:bg-neutral-50">
                  <td className="px-5 py-3 font-medium text-neutral-900">{g.email}</td>
                  <td className="px-5 py-3 text-neutral-600">{g.name || '—'}</td>
                  <td className="px-5 py-3 text-neutral-500">
                    <span>{formatDate(g.createdAt)}</span>
                    <span className="ml-2 text-xs text-neutral-400">{timeAgo(g.createdAt)}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDeleteOne(g.email)}
                      disabled={acting === g.email}
                      className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                    >
                      {acting === g.email ? 'Excluindo…' : 'Excluir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Legenda */}
      <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
        <strong>Como funciona:</strong> Contas criadas no app produtor a partir de agora são marcadas automaticamente.
        Registros com mais de 1 hora sem concluir o wizard aparecem nesta lista.
        A exclusão remove permanentemente a conta do Firebase Auth e do Firestore.
      </div>
    </div>
  )
}
