# Integrações

Como configurar e usar as integrações externas.

## Firebase

### Criação do projeto

1. Acessar https://console.firebase.google.com
2. "Adicionar projeto" → nome (ex: `marketplace-delivery-prod`)
3. **Recomendação:** criar 2 projetos:
   - `marketplace-delivery-dev` — para desenvolvimento
   - `marketplace-delivery-prod` — para produção
4. Habilitar Google Analytics (opcional mas recomendado)

### Habilitar serviços

No console do projeto, ativar:

- **Authentication** → Sign-in method:
  - Email/Password ✅
  - Google ✅
  - Phone (opcional, custos extras)
- **Firestore Database** → Modo produção, região `southamerica-east1` (São Paulo)
- **Storage** → Mesma região
- **Functions** → Plano Blaze (pay-as-you-go) é obrigatório

### Obter credenciais Web SDK

Project Settings → Geral → Seus apps → Adicionar app → Web

Copiar as 6 variáveis para `.env.local` de cada app:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=projeto-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=projeto.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123...:web:abc
```

### Obter credenciais Admin SDK (para Cloud Functions e backend)

Project Settings → Service Accounts → Generate new private key

Baixa um JSON. **NUNCA commitar.** Extrair 3 campos:

```bash
FIREBASE_ADMIN_PROJECT_ID=projeto-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@projeto.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> **Atenção:** o `PRIVATE_KEY` tem `\n` literais — preservar exatamente. Em produção (Netlify), passar como single-line escapando `\n`.

### Emuladores locais

```bash
firebase init emulators
# Selecionar: Auth, Functions, Firestore, Storage
```

`firebase.json`:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 },
    "singleProjectMode": true
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "functions": [{
    "source": "functions",
    "codebase": "default",
    "runtime": "nodejs22"
  }]
}
```

Rodar: `pnpm firebase:emulators`. UI em http://localhost:4000.

Os apps em modo dev devem detectar emuladores e conectar automaticamente:

```typescript
// packages/shared-firebase/src/client.ts
if (process.env.NODE_ENV === 'development') {
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectFirestoreEmulator(firestore, 'localhost', 8080)
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}
```

---

## Mercado Pago

### Criação da aplicação

1. Acessar https://www.mercadopago.com.br/developers
2. Criar conta de desenvolvedor (se ainda não tem)
3. "Suas integrações" → "Criar aplicação"
4. Tipo: "Pagamentos online"
5. Plataforma: "Não uso uma plataforma"
6. Modelo: "Pagamentos via PIX, cartão e outras"

### Credenciais

Cada aplicação tem **2 conjuntos** de credenciais:

| Ambiente | Public Key | Access Token |
|----------|-----------|--------------|
| **Sandbox (testes)** | `TEST-xxx` | `TEST-xxx` |
| **Produção** | `APP_USR-xxx` | `APP_USR-xxx` |

**Public Key:** vai no client (consumidor) — usada para tokenizar cartão sem o cartão tocar nosso servidor.

**Access Token:** vai apenas em Cloud Functions — usado para criar pagamentos, consultar status, fazer refunds.

`.env.local` do consumidor:
```bash
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=TEST-xxx
```

Variáveis das Cloud Functions:
```bash
MERCADO_PAGO_ACCESS_TOKEN=TEST-xxx
MERCADO_PAGO_WEBHOOK_SECRET=...
```

### Fluxo de pagamento PIX

1. **Client (consumidor)** chama Cloud Function `createOrder` com os dados do pedido
2. **Cloud Function:**
   - Valida o pedido (preços, estoque, cupom)
   - Cria documento em `orders/` com status `pending`
   - Chama Mercado Pago API:
     ```typescript
     POST https://api.mercadopago.com/v1/payments
     {
       transaction_amount: total / 100,  // converter centavos → reais
       payment_method_id: 'pix',
       payer: { email: customer.email },
       external_reference: orderId,
       notification_url: 'https://...cloudfunctions.net/mercadoPagoWebhook',
       date_of_expiration: '...'         // 30 min
     }
     ```
   - Retorna `pixCode` (copy-paste) e `pixQrCodeUrl`
   - Salva esses dados em `orders/{id}.payment`
3. **Client** mostra QR code e abre listener `onSnapshot` no pedido
4. **Cliente paga no banco** → Mercado Pago notifica via webhook
5. **Webhook** (HTTP function `mercadoPagoWebhook`):
   - Valida assinatura HMAC do header `x-signature`
   - Busca o pagamento na API do MP
   - Atualiza `orders/{id}.payment.status = 'approved'`
   - Atualiza `orders/{id}.status = 'confirmed'`
6. **Client** vê o `onSnapshot` disparar → redireciona para tela de sucesso

### Fluxo de pagamento Cartão (Bricks)

Mais complexo — usa SDK do Mercado Pago no client (Bricks):

1. **Client** carrega o Brick de Card Payment
2. Usuário preenche dados do cartão **diretamente nos iframes do MP** (PCI compliance — cartão nunca toca nosso código)
3. MP retorna um `cardToken`
4. **Client** chama Cloud Function `createOrder` com `cardToken`
5. **Cloud Function** chama API do MP passando o token
6. MP processa, retorna sucesso/falha **na hora**
7. Webhook chega depois para confirmar

### Validação de webhook

**Crítico:** sem validar assinatura, qualquer um pode forjar pagamentos confirmados.

```typescript
import crypto from 'crypto'

function validateMpWebhook(req: Request): boolean {
  const signature = req.headers['x-signature'] as string
  const requestId = req.headers['x-request-id'] as string

  // Formato: "ts=TIMESTAMP,v1=HASH"
  const parts = signature.split(',')
  const ts = parts.find(p => p.startsWith('ts='))?.split('=')[1]
  const hash = parts.find(p => p.startsWith('v1='))?.split('=')[1]

  const dataId = req.query['data.id'] as string

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`

  const computed = crypto
    .createHmac('sha256', process.env.MERCADO_PAGO_WEBHOOK_SECRET!)
    .update(manifest)
    .digest('hex')

  return computed === hash
}
```

O segredo do webhook é obtido no painel do MP: "Webhooks" → "Configurar notificações".

### Testes em sandbox

MP fornece **cartões de teste**:

| Marca | Número | Resultado |
|-------|--------|-----------|
| Mastercard | 5031 4332 1540 6351 | Aprovado |
| Visa | 4509 9535 6623 3704 | Aprovado |
| Amex | 3711 803032 57522 | Aprovado |
| (qualquer) | usar CVV `123`, validade futura | |

Para forçar falha, usar nome de portador específico:
- `OTHE` — outro erro
- `CALL` — chamar autorização
- `FUND` — sem fundos
- `SECU` — código de segurança inválido

### Indo para produção

1. Trocar credenciais sandbox → produção
2. Configurar `notification_url` apontando para a Cloud Function de produção
3. Configurar webhook secret de produção
4. Testar com **valor baixo real** (R$ 0,50) antes de abrir para clientes
5. Monitorar primeiros 100 pedidos com atenção

---

## Focus NFe (preparação, não implementação)

A integração real é da Etapa 7+. Por enquanto, apenas **preparar a estrutura de dados**.

### O que preparar agora

- Campos fiscais em `restaurants.fiscal` (já modelado em `docs/database.md`)
- Campos fiscais em `orders.invoice`
- Variáveis de ambiente reservadas:
  ```bash
  FOCUS_NFE_TOKEN_PROD=
  FOCUS_NFE_TOKEN_HOMOLOG=
  FOCUS_NFE_ENVIRONMENT=homolog  # ou 'production'
  ```

### Como vai funcionar no futuro

1. Pedido vira `delivered`
2. Cloud Function `issueInvoice` dispara
3. Monta payload conforme spec da Focus NFe:
   - Dados do restaurante (emitente)
   - Dados do cliente (destinatário)
   - Itens com NCM e CFOP
   - Total, impostos
4. POST para API da Focus
5. Recebe número da NF-e e URL do XML/PDF
6. Salva em `orders/{id}.invoice`

### Decisões a tomar quando chegar a hora

- NFC-e (consumidor final) ou NF-e (B2B)? → **NFC-e** para delivery
- Emissão por restaurante (cada um com seu CNPJ) ou pela plataforma? → **Por restaurante** (cada um emite a sua)
- Quem paga a Focus? → Plataforma cobre o custo na comissão

---

## Netlify

### Por que Netlify (e não Vercel)

Decisão do escopo do projeto. Trade-offs:

| Critério | Netlify | Vercel |
|----------|---------|--------|
| Next.js | Bom com plugin | Nativo (criado pela Vercel) |
| Preço | Generoso free tier | Generoso, mas paywalls mais agressivos |
| Build minutes free | 300/mês | 6000/mês (Hobby) |
| Bandwidth | 100GB free | 100GB free |
| Edge Functions | Sim | Sim |
| Forms | ✅ nativo | ❌ |

Netlify é uma escolha válida e econômica, especialmente quando há múltiplos sites.

### Setup por app

Para cada um dos 3 apps (consumidor, produtor, backoffice):

1. **Conectar GitHub:** "Add new site" → "Import from Git"
2. **Selecionar repositório** do monorepo
3. **Configurar build:**
   - Base directory: `apps/consumidor` (ou produtor / backoffice)
   - Build command: `cd ../.. && pnpm install --frozen-lockfile && pnpm build --filter=@marketplace/consumidor`
   - Publish directory: `apps/consumidor/.next`
4. **Adicionar plugin oficial** `@netlify/plugin-nextjs` (no `netlify.toml` do app)
5. **Variáveis de ambiente:** adicionar todas as `NEXT_PUBLIC_*` no painel Netlify

### `netlify.toml` por app

`apps/consumidor/netlify.toml`:

```toml
[build]
  command = "cd ../.. && pnpm install --frozen-lockfile && pnpm build --filter=@marketplace/consumidor"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "22"
  NPM_FLAGS = "--version"  # truque pra Netlify usar pnpm
  PNPM_VERSION = "9"
```

Repetir para os outros apps mudando o filter.

### Domínio customizado

1. Para cada site, "Domain management" → "Add custom domain"
2. Apontar DNS:
   - `app.seusite.com` → CNAME para `consumidor-xxxx.netlify.app`
   - `parceiro.seusite.com` → CNAME para `produtor-xxxx.netlify.app`
   - `admin.seusite.com` → CNAME para `backoffice-xxxx.netlify.app`
3. HTTPS automático via Let's Encrypt (Netlify cuida)

### Deploys e branches

Padrão:

- `main` → produção
- `develop` → staging (Deploy Preview)
- Branches feature → Deploy Preview por PR

Cada PR gera uma URL `deploy-preview-N--site.netlify.app` para revisar.

---

## Resumo de variáveis de ambiente

Por escopo de onde elas vivem:

### Em cada app (`.env.local` no dev, painel Netlify em prod)

```bash
# Firebase Web SDK (públicas)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# URL do próprio app (varia por app)
NEXT_PUBLIC_APP_URL=https://app.seusite.com

# Só no consumidor
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=     # ou Mapbox
```

### Em Cloud Functions (`functions/.env` no dev, `firebase functions:secrets:set` em prod)

```bash
# Mercado Pago (privadas)
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=

# Focus NFe (futuro)
FOCUS_NFE_TOKEN=
FOCUS_NFE_ENVIRONMENT=

# Email (futuro — SendGrid/Resend)
RESEND_API_KEY=
EMAIL_FROM=

# Outras
SENTRY_DSN=
```

### Segredos no Firebase Functions (recomendado em vez de .env em prod)

```bash
firebase functions:secrets:set MERCADO_PAGO_ACCESS_TOKEN
firebase functions:secrets:set MERCADO_PAGO_WEBHOOK_SECRET
# etc.
```

Na function:

```typescript
import { defineSecret } from 'firebase-functions/params'

const mpToken = defineSecret('MERCADO_PAGO_ACCESS_TOKEN')

export const myFunction = onCall(
  { secrets: [mpToken] },
  async (request) => {
    const token = mpToken.value()
    // ...
  }
)
```
