'use client'

import {
  callGetStripeOnboardingLink,
  callRefreshStripeAccountStatus,
} from '@marketplace/shared-services'
import { useEffect, useState } from 'react'
import { useProdutorAtivo } from '@/hooks/useProdutorAtivo'

// ──────────────────────────────────────────────────────
//  Conteúdo didático
//
//  O produtor típico não é familiarizado com gateways de pagamento, então a
//  página explica o que será pedido ANTES de mandá-lo para o site da Stripe.
//  Chegar no formulário sem os documentos em mãos é o principal motivo de
//  cadastro abandonado pela metade.
// ──────────────────────────────────────────────────────

const DOCUMENTOS = [
  {
    icon: '🪪',
    title: 'Seus dados pessoais',
    items: [
      'Nome completo, exatamente como está no documento',
      'CPF',
      'Data de nascimento',
      'Telefone e e-mail',
    ],
  },
  {
    icon: '🏠',
    title: 'Seu endereço',
    items: ['CEP', 'Rua, número e complemento', 'Bairro, cidade e estado'],
  },
  {
    icon: '🏦',
    title: 'Sua conta bancária',
    items: [
      'Banco',
      'Agência e número da conta (com dígito)',
      'Se é conta corrente ou poupança',
      'A conta precisa estar no seu CPF',
    ],
  },
  {
    icon: '📄',
    title: 'Um documento com foto',
    items: [
      'RG ou CNH',
      'Frente e verso',
      'Pode ser foto pelo celular, desde que esteja legível',
    ],
  },
]

const PASSOS = [
  {
    title: 'Clique no botão no fim desta página',
    text: 'Você será levado para o site da Stripe, a empresa que processa os pagamentos do Brota.',
  },
  {
    title: 'Preencha seus dados',
    text: 'A Stripe vai pedir as informações da lista acima. Leva cerca de 10 minutos com tudo em mãos.',
  },
  {
    title: 'Envie a foto do documento',
    text: 'É a etapa de verificação de identidade, exigida por lei para quem recebe pagamentos.',
  },
  {
    title: 'Volte para o Brota',
    text: 'Ao terminar, você retorna automaticamente e o status aqui muda para "Conectado".',
  },
]

const DUVIDAS = [
  {
    q: 'Preciso pagar alguma coisa para conectar?',
    a: 'Não. Conectar a conta é gratuito. A comissão do Brota é descontada automaticamente de cada pedido — você nunca precisa transferir nada para a plataforma.',
  },
  {
    q: 'Por que o Brota não pede meus dados bancários direto?',
    a: 'Por segurança. O Brota nunca vê nem armazena seus dados bancários. Eles ficam apenas com a Stripe, que é certificada internacionalmente para isso. Se o site do Brota fosse invadido, seus dados bancários não estariam lá.',
  },
  {
    q: 'Quando o dinheiro cai na minha conta?',
    a: 'Assim que o pedido é confirmado, sua parte é separada automaticamente. O depósito no seu banco segue o calendário da Stripe, normalmente em poucos dias úteis.',
  },
  {
    q: 'Posso vender antes de conectar?',
    a: 'Não. Seus produtos ficam indisponíveis para compra até a conta estar conectada. É uma proteção: sem isso não haveria como te repassar o dinheiro de uma venda.',
  },
  {
    q: 'Comecei o cadastro mas não terminei. E agora?',
    a: 'Sem problema. Volte aqui e clique em "Continuar cadastro" — você retoma de onde parou, sem perder o que já preencheu.',
  },
  {
    q: 'Errei um dado. Consigo corrigir?',
    a: 'Sim. Se a Stripe identificar algum problema, o status aqui volta para "Cadastro incompleto" e você pode reabrir o formulário para ajustar.',
  },
]

export default function RecebimentoPage() {
  const { produtor, loading } = useProdutorAtivo()

  const [onboarded, setOnboarded] = useState(false)
  const [hasAccount, setHasAccount] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!produtor) return
    setOnboarded(produtor.stripeOnboarded === true)
    setHasAccount(!!produtor.stripeAccountId)
  }, [produtor])

  // Ao voltar do onboarding (return_url traz ?stripe=return), reconsulta o
  // status para refletir na hora, sem depender do webhook account.updated.
  useEffect(() => {
    if (typeof window === 'undefined' || !produtor) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') !== 'return') return
    let active = true
    ;(async () => {
      try {
        const res = await callRefreshStripeAccountStatus(produtor.id)
        if (!active) return
        setOnboarded(res.stripeOnboarded)
        setHasAccount(res.hasAccount)
      } catch {
        /* silencioso — o produtor pode tentar de novo */
      } finally {
        window.history.replaceState({}, '', window.location.pathname)
      }
    })()
    return () => {
      active = false
    }
  }, [produtor])

  async function handleConnect() {
    if (!produtor) return
    setBusy(true)
    setErr(null)
    try {
      const url = await callGetStripeOnboardingLink(produtor.id)
      window.location.href = url
    } catch {
      setErr('Não foi possível abrir o cadastro. Verifique sua conexão e tente novamente.')
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!produtor) {
    return (
      <div className="p-10 text-center text-sm text-neutral-500">
        Nenhum produtor encontrado.
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6 pb-10">
      {/* Cabeçalho + status */}
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">Recebimento</h1>
          {onboarded ? (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Conectado
            </span>
          ) : hasAccount ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Cadastro incompleto
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
              Não conectado
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Aqui você conecta a conta bancária que vai receber o dinheiro das suas vendas.
        </p>
      </header>

      {/* Estado conectado */}
      {onboarded && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex gap-3">
            <span className="text-2xl" aria-hidden="true">
              ✅
            </span>
            <div>
              <h2 className="text-base font-bold text-emerald-900">
                Tudo certo — sua conta está conectada
              </h2>
              <p className="mt-1 text-sm text-emerald-800">
                Seus produtos já podem ser vendidos. A cada pedido, sua parte é
                separada automaticamente e enviada para a sua conta bancária, já
                com a comissão da plataforma descontada. Você não precisa fazer
                mais nada.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Como o dinheiro chega */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-neutral-800">
          Como o dinheiro chega até você
        </h2>
        <ol className="space-y-3 text-sm text-neutral-600">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              1
            </span>
            <span>O cliente faz um pedido e paga uma única vez pelo app.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              2
            </span>
            <span>
              O sistema calcula quanto é seu, olhando só os seus produtos dentro
              daquele pedido.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              3
            </span>
            <span>A comissão do Brota é descontada desse valor.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
              4
            </span>
            <span>
              O restante vai automaticamente para a sua conta bancária. Se o
              pedido tiver produtos de vários produtores, cada um recebe a sua
              parte separadamente.
            </span>
          </li>
        </ol>
      </section>

      {/* Fluxo de conexão — só aparece se ainda não conectou */}
      {!onboarded && (
        <>
          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-neutral-800">
              Separe estes documentos antes de começar
            </h2>
            <p className="mt-1 mb-5 text-sm text-neutral-500">
              Com tudo em mãos, o cadastro leva cerca de 10 minutos. Sem isso,
              você vai precisar parar no meio para procurar.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {DOCUMENTOS.map((bloco) => (
                <div
                  key={bloco.title}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg" aria-hidden="true">
                      {bloco.icon}
                    </span>
                    <h3 className="text-sm font-bold text-neutral-800">{bloco.title}</h3>
                  </div>
                  <ul className="space-y-1.5" role="list">
                    {bloco.items.map((item) => (
                      <li key={item} className="flex gap-2 text-xs text-neutral-600">
                        <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-brand-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-neutral-800">
              O que vai acontecer
            </h2>
            <ol className="space-y-4">
              {PASSOS.map((passo, i) => (
                <li key={passo.title} className="flex gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-800">{passo.title}</h3>
                    <p className="mt-0.5 text-sm text-neutral-500">{passo.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* CTA */}
          <section className="rounded-xl border border-brand-200 bg-brand-50 p-6">
            <h2 className="text-base font-bold text-brand-900">
              {hasAccount ? 'Continue de onde parou' : 'Pronto para conectar?'}
            </h2>
            <p className="mt-1 mb-4 text-sm text-brand-800">
              {hasAccount
                ? 'Seu cadastro ficou incompleto. Nada do que você preencheu foi perdido.'
                : 'Enquanto sua conta não estiver conectada, seus produtos ficam indisponíveis para compra.'}
            </p>

            {err && (
              <p
                role="alert"
                className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
              >
                {err}
              </p>
            )}

            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {busy
                ? 'Abrindo…'
                : hasAccount
                  ? 'Continuar cadastro'
                  : 'Conectar minha conta bancária'}
            </button>

            <p className="mt-3 text-xs text-brand-700">
              Você será levado para o site da Stripe. O Brota não tem acesso aos
              seus dados bancários.
            </p>
          </section>
        </>
      )}

      {/* Dúvidas */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-neutral-800">Dúvidas frequentes</h2>
        <div className="divide-y divide-neutral-200">
          {DUVIDAS.map((d) => (
            <details key={d.q} className="group py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-800 hover:text-brand-700">
                {d.q}
                <svg
                  className="h-4 w-4 flex-shrink-0 text-neutral-400 transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-2 pr-7 text-sm leading-relaxed text-neutral-600">{d.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-neutral-400">
        Ficou com dúvida? Fale com o suporte do Brota antes de preencher — é
        melhor perguntar do que cadastrar errado.
      </p>
    </div>
  )
}
