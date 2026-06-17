# POC — Split de pagamento com Stripe Connect (modo teste)

Prova de conceito **isolada** (fora do monorepo) para validar que **um único
pagamento** do consumidor pode ser **dividido automaticamente** entre vários
produtores, retendo a comissão da plataforma — exatamente o modelo desejado.

Tudo roda em **modo de teste** do Stripe. Nenhum dinheiro real é movimentado.

## Pré-requisitos

- Node 18+ (você tem o 24)
- Conta Stripe com Connect ativado em modo teste

## Passos

```bash
cd "experiments/stripe-poc"

# 1. Instalar a dependência (só o SDK do Stripe)
npm install

# 2. Configurar a chave secreta de TESTE
#    Copie .env.example para .env e cole sua sk_test_ lá
#    (no Windows PowerShell: Copy-Item .env.example .env)

# 3. Criar 2 produtores de teste + links de cadastro
npm run setup
#    → abra os 2 links impressos no navegador e complete o cadastro de teste

# 4. Conferir se os produtores já podem receber
npm run status

# 5. Rodar o pagamento dividido entre os 2 produtores
npm run split

# (extra) Ver um pagamento PIX de teste
npm run pix
```

## O que cada comando prova

| Comando | O que demonstra |
|---------|-----------------|
| `setup` | Onboarding de produtor (a fricção real de cadastro no Brasil) |
| `status` | Quando o produtor fica apto a receber |
| `split` | **1 pagamento → repasse automático para N produtores + comissão retida** |
| `pix` | PIX é só a forma de pagamento; o split usa os mesmos Transfers |

## Pedido simulado (em `split-poc.mjs`)

- Horta do João: R$ 30,00 (repasse R$ 27,00 após 10% de comissão)
- Sítio da Maria: R$ 20,00 (repasse R$ 18,00 após 10% de comissão)
- Frete: R$ 10,00 (fica com a plataforma)
- **Total pago pelo consumidor: R$ 60,00** → plataforma retém R$ 15,00
