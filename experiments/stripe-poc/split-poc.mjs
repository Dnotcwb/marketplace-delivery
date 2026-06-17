// ─────────────────────────────────────────────────────────────────────────────
//  PROVA DE CONCEITO — Split de pagamento com Stripe Connect (MODO TESTE)
//
//  Objetivo: provar que UM pagamento do consumidor pode ser dividido
//  AUTOMATICAMENTE entre VÁRIOS produtores, retendo a comissão da plataforma.
//
//  Modelo usado: "separate charges and transfers"
//   1. O consumidor paga o valor cheio → cai no saldo da PLATAFORMA.
//   2. A plataforma cria um Transfer para cada produtor (a parte dele, já
//      descontada a comissão). O Transfer é amarrado à cobrança via
//      `source_transaction`, então o dinheiro fica disponível na hora.
//   3. O que sobra (comissões + frete) permanece com a plataforma.
//
//  Este script NÃO faz parte do monorepo e não toca em nenhum app.
//
//  Comandos:
//   node --env-file=.env split-poc.mjs setup   → cria 2 produtores de teste + links de cadastro
//   node --env-file=.env split-poc.mjs status  → mostra se os produtores já podem receber
//   node --env-file=.env split-poc.mjs split   → executa 1 pagamento e divide entre os 2
//   node --env-file=.env split-poc.mjs pix      → (extra) cria um pagamento PIX de teste
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'stripe'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const secret = process.env.STRIPE_SECRET_KEY
if (!secret || !secret.startsWith('sk_test_')) {
  console.error('\n❌ STRIPE_SECRET_KEY ausente ou não é de teste (precisa começar com sk_test_).')
  console.error('   Crie o arquivo .env (copie de .env.example) e cole sua secret key de TESTE.\n')
  process.exit(1)
}

const stripe = new Stripe(secret)
const STATE_FILE = new URL('./.poc-state.json', import.meta.url)

// Valores em centavos (como no projeto real).
const PEDIDO = {
  produtorA: { nome: 'Horta do João',  subtotal: 3000 }, // R$ 30,00
  produtorB: { nome: 'Sítio da Maria', subtotal: 2000 }, // R$ 20,00
  frete: 1000,        // R$ 10,00 → fica com a plataforma
  comissaoPct: 10,    // 10% sobre o subtotal de cada produtor → fica com a plataforma
}

const brl = (cents) => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`

function loadState() {
  if (!existsSync(STATE_FILE)) return {}
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
}
function saveState(s) {
  writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
}

// ── SETUP: cria 2 contas de produtor de teste + links de onboarding ──────────
async function setup() {
  console.log('\n🌱 Criando 2 contas de produtor de teste (Stripe Connect, país BR)...\n')
  const state = {}

  for (const key of ['produtorA', 'produtorB']) {
    const acct = await stripe.accounts.create({
      type: 'express',
      country: 'BR',
      email: `${key}-${Date.now()}@teste.com`,
      business_type: 'individual',
      capabilities: {
        // No Brasil, `transfers` exige também `card_payments`.
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { poc: 'true', produtor: PEDIDO[key].nome },
    })

    const link = await stripe.accountLinks.create({
      account: acct.id,
      refresh_url: 'https://example.com/reauth',
      return_url: 'https://example.com/return',
      type: 'account_onboarding',
    })

    state[key] = { accountId: acct.id, nome: PEDIDO[key].nome }
    console.log(`  ✅ ${PEDIDO[key].nome}`)
    console.log(`     accountId: ${acct.id}`)
    console.log(`     👉 ABRA este link no navegador e complete o cadastro de teste:`)
    console.log(`     ${link.url}\n`)
  }

  saveState(state)
  console.log('Estado salvo em .poc-state.json')
  console.log('\nDepois de completar o cadastro dos DOIS links acima, rode:')
  console.log('  npm run status   (confere se já podem receber)')
  console.log('  npm run split    (executa o pagamento dividido)\n')
}

// ── STATUS: verifica se cada produtor já pode receber transfers ──────────────
async function status() {
  const state = loadState()
  if (!state.produtorA) {
    console.error('\n❌ Rode `npm run setup` primeiro.\n')
    process.exit(1)
  }

  console.log('\n🔎 Status dos produtores:\n')
  let todosProntos = true
  for (const key of ['produtorA', 'produtorB']) {
    const acct = await stripe.accounts.retrieve(state[key].accountId)
    const podeReceber = acct.capabilities?.transfers === 'active'
    if (!podeReceber) todosProntos = false
    console.log(`  ${podeReceber ? '✅' : '⏳'} ${state[key].nome}`)
    console.log(`     transfers: ${acct.capabilities?.transfers ?? 'n/d'}`)
    if (acct.requirements?.currently_due?.length) {
      console.log(`     pendências: ${acct.requirements.currently_due.join(', ')}`)
    }
    console.log('')
  }

  console.log(
    todosProntos
      ? '🎉 Todos prontos! Pode rodar `npm run split`.\n'
      : '⏳ Ainda há produtor pendente — complete o link de cadastro e rode `npm run status` de novo.\n',
  )
}

// ── SPLIT: 1 pagamento do consumidor → dividido entre os 2 produtores ────────
async function split() {
  const state = loadState()
  if (!state.produtorA) {
    console.error('\n❌ Rode `npm run setup` primeiro.\n')
    process.exit(1)
  }

  const repasseA = Math.round(PEDIDO.produtorA.subtotal * (1 - PEDIDO.comissaoPct / 100))
  const repasseB = Math.round(PEDIDO.produtorB.subtotal * (1 - PEDIDO.comissaoPct / 100))
  const total = PEDIDO.produtorA.subtotal + PEDIDO.produtorB.subtotal + PEDIDO.frete
  const ficaPlataforma = total - repasseA - repasseB

  console.log('\n🧾 Pedido simulado:')
  console.log(`   ${PEDIDO.produtorA.nome}: subtotal ${brl(PEDIDO.produtorA.subtotal)} → repasse ${brl(repasseA)}`)
  console.log(`   ${PEDIDO.produtorB.nome}: subtotal ${brl(PEDIDO.produtorB.subtotal)} → repasse ${brl(repasseB)}`)
  console.log(`   Frete: ${brl(PEDIDO.frete)} (plataforma)`)
  console.log(`   ─────────────────────────────`)
  console.log(`   TOTAL pago pelo consumidor: ${brl(total)}`)
  console.log(`   Comissão+frete p/ plataforma: ${brl(ficaPlataforma)}\n`)

  // 1. Consumidor paga o valor cheio → saldo da plataforma.
  console.log('💳 Passo 1: cobrando o consumidor (cartão de teste pm_card_visa)...')
  const intent = await stripe.paymentIntents.create({
    amount: total,
    currency: 'brl',
    payment_method: 'pm_card_visa',
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    description: 'POC pedido multi-produtor',
  })
  const chargeId = intent.latest_charge
  console.log(`   ✅ Pago. PaymentIntent ${intent.id} (status: ${intent.status}), charge ${chargeId}\n`)

  // 2. Transfere a parte de cada produtor, amarrada à cobrança (fundos na hora).
  console.log('💸 Passo 2: dividindo automaticamente entre os produtores...')
  const tA = await stripe.transfers.create({
    amount: repasseA,
    currency: 'brl',
    destination: state.produtorA.accountId,
    source_transaction: chargeId,
    description: `Repasse ${state.produtorA.nome}`,
  })
  console.log(`   ✅ ${state.produtorA.nome} recebeu ${brl(repasseA)} (transfer ${tA.id})`)

  const tB = await stripe.transfers.create({
    amount: repasseB,
    currency: 'brl',
    destination: state.produtorB.accountId,
    source_transaction: chargeId,
    description: `Repasse ${state.produtorB.nome}`,
  })
  console.log(`   ✅ ${state.produtorB.nome} recebeu ${brl(repasseB)} (transfer ${tB.id})\n`)

  console.log('🎉 SPLIT CONCLUÍDO — 1 pagamento do consumidor, repasse automático para 2 produtores.')
  console.log(`   Plataforma reteve ${brl(ficaPlataforma)} (comissão + frete).`)
  console.log('   Veja no dashboard: https://dashboard.stripe.com/test/connect/transfers\n')
}

// ── PIX (extra): mostra que o PIX gera QR e usa o MESMO split depois ─────────
async function pix() {
  console.log('\n🔷 Criando um pagamento PIX de teste (R$ 50,00)...')
  const intent = await stripe.paymentIntents.create({
    amount: 5000,
    currency: 'brl',
    payment_method_types: ['pix'],
    description: 'POC pagamento PIX',
  })
  console.log(`   ✅ PaymentIntent PIX criado: ${intent.id} (status: ${intent.status})`)
  console.log('   Observação: o PIX é apenas a FORMA de pagamento. Depois que ele é')
  console.log('   confirmado, o split entre produtores usa exatamente os mesmos')
  console.log('   Transfers do comando `split`. A divisão independe de ser PIX ou cartão.\n')
}

// ── RELINK: gera um link de cadastro novo para quem ainda está pendente ──────
async function relink() {
  const state = loadState()
  if (!state.produtorA) {
    console.error('\n❌ Rode `npm run setup` primeiro.\n')
    process.exit(1)
  }

  console.log('\n🔗 Gerando links novos para produtores ainda pendentes...\n')
  let algumPendente = false
  for (const key of ['produtorA', 'produtorB']) {
    const acct = await stripe.accounts.retrieve(state[key].accountId)
    if (acct.capabilities?.transfers === 'active') {
      console.log(`  ✅ ${state[key].nome} já está pronto (sem link necessário).\n`)
      continue
    }
    algumPendente = true
    const link = await stripe.accountLinks.create({
      account: state[key].accountId,
      refresh_url: 'https://example.com/reauth',
      return_url: 'https://example.com/return',
      type: 'account_onboarding',
    })
    console.log(`  👉 ${state[key].nome} — abra e complete o cadastro:`)
    console.log(`     ${link.url}\n`)
  }

  if (!algumPendente) {
    console.log('🎉 Todos já estão prontos! Pode rodar `npm run split`.\n')
  }
}

const cmd = process.argv[2]
const fns = { setup, status, split, pix, relink }
if (!fns[cmd]) {
  console.log('\nUso: node --env-file=.env split-poc.mjs <setup|status|split|pix>\n')
  process.exit(1)
}
fns[cmd]().catch((err) => {
  console.error('\n❌ Erro:', err?.message ?? err)
  if (err?.raw?.message) console.error('   Detalhe Stripe:', err.raw.message)
  process.exit(1)
})
