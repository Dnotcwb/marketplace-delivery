# Contexto Técnico Completo — Ecossistema Marketplace Delivery (Brota)

> **Uso:** Este documento é um prompt de sistema destinado a outra IA. Leia-o integralmente antes de qualquer análise ou geração de código. Ele descreve o estado atual real e completo da plataforma.

---

## 1. Visão Geral do Ecossistema

### O Projeto

**Brota** é um marketplace de delivery multi-vendor focado em produtores de alimentos orgânicos e hortas urbanas. A plataforma conecta consumidores a produtores locais, organiza múltiplos produtores em "hortas" (espaços físicos coletivos), e gerencia todo o fluxo de pedidos, pagamentos e entregas.

O sistema é composto por **5 aplicações Next.js independentes** que compartilham um único backend Firebase, mais um **aplicativo HTML de monitoramento de carbono/compostagem** (projeto separado — `compostroca` / `compostroca-esg` — ainda não integrado ao monorepo, pendente de desenvolvimento).

### Os 5 Sistemas Integrados

| App | URL Produção | Porta Dev | Público-alvo | Função |
|-----|-------------|-----------|--------------|--------|
| **consumidor** | `marketplace-delivery-consumidor.netlify.app` | 3000 | Clientes finais | Navegar hortas/produtores, montar carrinho, finalizar pedido, acompanhar entrega em tempo real |
| **produtor** | `marketplace-delivery-produtor.netlify.app` | 3001 | Donos de hortas/lotes | Gerenciar catálogo, receber pedidos via Kanban, imprimir comanda térmica, ver relatórios |
| **backoffice** | `marketplace-delivery-backoffice.netlify.app` | 3002 | Administradores da plataforma | Aprovar/suspender produtores, gerenciar hortas, financeiro, cupons, entregadores |
| **entregador** | `marketplace-entregador.netlify.app` | 3003 | Motoristas/motoboys | Ver entregas disponíveis, aceitar, confirmar entrega, histórico e ganhos |
| **horta** | `marketplace-delivery-horta.netlify.app` | 3004 | Responsáveis de horta | Gerenciar dados da própria horta (nome, endereço, entrega), ver produtores vinculados |

### O App de Carbono/Compostagem (Pendente de Integração)

Existe um projeto separado (`compostroca` / `compostroca-esg`) hospedado no Netlify que monitora métricas de compostagem e carbono. **Não está integrado ao monorepo atual.** A integração futura pode incluir:
- Score ESG de cada horta/produtor exibido no consumidor
- Relatório de impacto ambiental no backoffice
- Compartilhamento de dados via Firestore ou REST API

---

## 2. Arquitetura e Integração

### Diagrama de Comunicação

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE (marketplace-delivery-dev)          │
│                                                                 │
│   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│   │  Auth       │   │  Firestore   │   │  Cloud Functions │   │
│   │  (JWT +     │   │  (NoSQL DB)  │   │  (Node 22, SAE1) │   │
│   │  claims)    │   │              │   │                  │   │
│   └─────────────┘   └──────────────┘   └──────────────────┘   │
│          │                 │                    │              │
└──────────┼─────────────────┼────────────────────┼─────────────┘
           │                 │                    │
     ┌─────▼──────────────────▼────────────────────▼───────┐
     │              Firebase Web SDK 10.12.0                │
     │         (@marketplace/shared-firebase package)       │
     └──────────────────────────────────────────────────────┘
                │           │           │          │
          ┌─────▼──┐  ┌─────▼──┐  ┌────▼──┐  ┌───▼────┐
          │consumi-│  │produ-  │  │back-  │  │entre-  │
          │dor     │  │tor     │  │office │  │gador   │  horta
          └────────┘  └────────┘  └───────┘  └────────┘   │
                                                           └──▶
```

### Fluxo de Dados Principal

1. **Autenticação**: Firebase Auth emite JWT com custom claims (`role`, `produtorIds`, `hortaId`). Token é cacheado no cliente; refresh forçado com `getIdTokenResult(true)` antes de decisões críticas de roteamento.

2. **Regras Firestore**: Cada operação é verificada server-side pelo campo `request.auth.token.role`. O cliente nunca precisa "confiar" — as regras são a fonte de verdade.

3. **Pedidos**: O fluxo completo de um pedido passa **obrigatoriamente** pela Cloud Function `createOrder` (não é possível criar pedidos diretamente do cliente via Firestore rules). A CF valida estoque, aplica cupom, calcula frete e cria o documento.

4. **Pagamentos**: Mercado Pago processa PIX/cartão. O webhook `mercadoPagoWebhook` (HTTPS trigger) recebe confirmação e atualiza o status do pedido em Firestore via admin SDK.

5. **Tempo real**: Todos os apps usam `onSnapshot()` do Firestore para receber atualizações em tempo real sem polling.

6. **Notificações Push**: Cloud Functions disparam FCM via `sendPush()` helper quando status de pedido muda. Tokens FCM armazenados em `users/{uid}/fcmTokens`.

### Modelo Multi-Produtor (Hortas)

Uma horta pode ter N produtores. Quando um cliente faz um pedido de múltiplos produtores dentro de uma horta:
- Um `orders` pai é criado (contém todos os itens, pagamento único)
- Um `pedidos_filhos` é criado para cada produtor envolvido
- Cada produtor vê apenas seu `pedido_filho` no app produtor
- O cliente vê o pedido pai com status consolidado
- Triggers Firestore propagam mudanças de status entre pai e filhos

---

## 3. Stack Tecnológica Completa

### Frontend (todos os 5 apps)

| Categoria | Tecnologia | Versão | Observação |
|-----------|-----------|--------|------------|
| Framework | Next.js | 16.2.6 | App Router nativo, **Turbopack ativo** em dev |
| UI | React | 19.2.4 | Concurrent Mode |
| Linguagem | TypeScript | 5.5.x | strict: true em todos |
| Styling | Tailwind CSS | 4.x | Config via `@theme` em CSS (sem `tailwind.config.js`) |
| Postprocessing | @tailwindcss/postcss | ^4 | |
| Forms | React Hook Form | 7.52.0 | + Zod 3.23 (validação) |
| Resolver | @hookform/resolvers | 3.6.0 | |
| Firebase | firebase (Web SDK) | 10.12.0 | Auth, Firestore, Storage, Functions, Messaging |
| Roteamento | Next.js App Router | — | Sem React Router |
| Estado global | React Context API | — | Sem Redux/Zustand |
| Fontes | next/font (Inter) | — | Otimizado para CWV |

### Backend

| Categoria | Tecnologia | Versão | Observação |
|-----------|-----------|--------|------------|
| Plataforma | Firebase | — | Projeto: `marketplace-delivery-dev` |
| Auth | Firebase Auth | — | Email/senha + custom claims |
| Banco | Cloud Firestore | — | NoSQL, modo native |
| Storage | Cloud Storage | — | Fotos de produtos, logos, banners |
| Functions | Firebase Functions v2 | — | Node.js 22, região `southamerica-east1` |
| Admin SDK | firebase-admin | — | Apenas nas Cloud Functions |
| Pagamentos | Mercado Pago | — | PIX + Cartão via Checkout Pro |
| Geocodificação | ViaCEP | API REST | CEP → endereço |
| Geocodificação | Nominatim (OSM) | API REST | Endereço → lat/lng (gratuito) |
| Imagens externas | Cloudinary | — | Upload de fotos de produtos |

### Infraestrutura e DevOps

| Categoria | Tecnologia | Observação |
|-----------|-----------|------------|
| Monorepo | Turborepo 2.9.14 | Pipeline de build com cache |
| Package Manager | pnpm 11.1.3 | Workspaces |
| Node | 24.15.0 | (mínimo: 22) |
| Hospedagem | Netlify | 5 sites, auto-deploy via GitHub |
| Repositório | GitHub | `github.com/Dnotcwb/marketplace-delivery` |
| CI/CD | Netlify + GitHub | Push em `main` → build automático |
| Secrets | Firebase Secret Manager | Tokens MP, chaves privadas |

### Paleta de Cores (design system unificado)

Todos os apps usam a mesma paleta "Ambiente Livre" definida em `globals.css`:
- `brand-500`: `#4A9080` (verde-musgo principal)
- `brand-900`: `#112520` (sidebar escura)
- Neutros: escala Slate (`neutral-50` a `neutral-900`)
- Estados: success `#16A34A`, warning `#D97706`, error `#DC2626`

---

## 4. Estrutura de Diretórios

```
marketplace-delivery/               ← Raiz do monorepo
│
├── apps/
│   ├── consumidor/                 ← App cliente final (porta 3000)
│   │   ├── src/app/
│   │   │   ├── (auth)/            ← Rotas públicas: login, cadastro, recuperar-senha
│   │   │   ├── (main)/            ← Rotas autenticadas: home, checkout, pedidos, perfil
│   │   │   └── layout.tsx         ← Root layout com AuthProvider + CartProvider
│   │   ├── src/components/        ← Header, CartDrawer, ProdutorCard, HortaCard, NotificationBell
│   │   ├── src/hooks/             ← useFcmToken, etc.
│   │   ├── public/                ← PWA icons, manifest
│   │   └── next.config.ts
│   │
│   ├── produtor/                   ← App produtor (porta 3001)
│   │   ├── src/app/
│   │   │   ├── (auth)/            ← login, cadastro, acesso-negado, aguardando-aprovacao
│   │   │   ├── (setup)/           ← /configurar (wizard de cadastro, 3 steps)
│   │   │   └── (dashboard)/       ← / (KPIs), /pedidos (Kanban), /catalogo, /configuracoes, /relatorios
│   │   ├── src/components/        ← ProdutorGuard, Sidebar, Topbar, Kanban, ProductForm
│   │   └── src/hooks/             ← useProdutorAtivo
│   │
│   ├── backoffice/                 ← App admin (porta 3002)
│   │   ├── src/app/
│   │   │   ├── (auth)/            ← /login
│   │   │   └── (dashboard)/       ← todas as rotas admin
│   │   │       ├── page.tsx       ← Dashboard KPIs
│   │   │       ├── produtores/    ← list + [id] detail
│   │   │       ├── hortas/        ← CRUD hortas + modal responsável
│   │   │       ├── pedidos/       ← todos pedidos
│   │   │       ├── cupons/        ← CRUD cupons
│   │   │       ├── entregadores/  ← aprovação drivers
│   │   │       ├── financeiro/    ← faturamento por produtor
│   │   │       ├── avaliacoes/    ← reviews
│   │   │       ├── registros-incompletos/ ← contas fantasma
│   │   │       └── configuracoes/ ← config global plataforma
│   │   └── src/components/        ← Sidebar (com badge pendentes), Topbar
│   │
│   ├── entregador/                 ← App entregador (porta 3003)
│   │   ├── src/app/
│   │   │   ├── (auth)/            ← login, cadastro, configurar, aguardando-aprovacao
│   │   │   └── (dashboard)/       ← / (entregas), /entrega/[id], /historico, /ganhos
│   │   └── src/components/        ← EntregadorGuard, DeliveryList
│   │
│   └── horta/                      ← App responsável de horta (porta 3004) [NOVO]
│       ├── src/app/
│       │   ├── (auth)/            ← /login (sem cadastro público — criado pelo admin)
│       │   └── (dashboard)/       ← / (dashboard), /minha-horta, /produtores
│       ├── src/components/        ← HortaGuard, HortaContext, Sidebar, Topbar
│       └── netlify.toml
│
├── packages/
│   ├── shared-types/               ← Interfaces TypeScript de todas as entidades
│   │   └── src/
│   │       ├── user.ts            ← User, UserRole ('cliente'|'produtor'|'admin'|'entregador'|'horta')
│   │       ├── produtor.ts        ← Produtor, ProdutorStatus, ProdutorAddress, etc.
│   │       ├── product.ts         ← Product, Category, ProductUnit
│   │       ├── order.ts           ← Order, OrderItem, OrderStatus, PedidoFilho, Coupon
│   │       ├── driver.ts          ← DeliveryDriver, DriverStatus
│   │       ├── horta.ts           ← Horta (com ownerUid/ownerEmail/ownerName)
│   │       ├── review.ts          ← Review, DriverReview
│   │       └── index.ts           ← Barrel export
│   │
│   ├── shared-firebase/            ← Inicialização Firebase Web SDK
│   │   └── src/
│   │       ├── client.ts          ← initializeApp + getApps() (evita dupla inicialização)
│   │       └── index.ts           ← Exporta: firestore, auth, storage, functions
│   │
│   ├── shared-services/            ← Camada de serviços (CRUD Firestore + lógica)
│   │   └── src/
│   │       ├── auth/
│   │       │   ├── AuthProvider.tsx    ← Context: user, claims, loading, claimsLoading, logout, signInWithEmail
│   │       │   └── useRequireRole.ts   ← Hook: redireciona se role incorreto
│   │       ├── admin/adminService.ts   ← callSetUserRole, callAssignHortaManager, callCleanupGhostProdutores
│   │       ├── produtor/produtorService.ts ← CRUD + subscribeToProdutor, subscribeToProdutores
│   │       ├── product/productService.ts   ← CRUD produtos + categorias
│   │       ├── order/orderService.ts       ← subscribeToOrder, subscribeToProdutorOrders, etc.
│   │       ├── horta/hortaService.ts       ← CRUD + subscribeToHortas, subscribeToHortaById, deleteHorta, removeHortaOwner
│   │       ├── address/addressService.ts   ← CRUD endereços do cliente
│   │       ├── coupon/couponService.ts     ← Validação + aplicação de cupons
│   │       ├── review/reviewService.ts     ← CRUD reviews de produtores
│   │       ├── review/driverReviewService.ts ← CRUD reviews de entregadores
│   │       ├── cart/CartProvider.tsx       ← Carrinho: Context + localStorage, 1 produtor/horta por vez
│   │       └── index.ts                   ← Barrel export
│   │
│   ├── shared-ui/                  ← Design system (Button, Card, Modal, Input, Badge, etc.)
│   ├── shared-utils/               ← Funções puras (formatCurrency, formatDate, calculateDistance)
│   └── shared-config/              ← ESLint, Prettier, tsconfig base
│
├── functions/                      ← Firebase Cloud Functions
│   └── src/
│       ├── auth/
│       │   ├── onUserCreated.ts        ← Trigger: cria users/{uid} com role='cliente'
│       │   ├── setUserRole.ts          ← Callable: admin altera role + claims (aceita 'horta' + hortaId)
│       │   ├── cleanupGhostProdutores.ts ← Callable: remove produtores abandonados (admin)
│       │   ├── selfRevokeOrphanedClaim.ts ← Callable: usuário revoga claim 'produtor' se doc deletado
│       │   └── assignHortaManager.ts   ← Callable: admin cria ou vincula responsável de horta
│       ├── orders/
│       │   ├── createOrder.ts          ← Callable: criação de pedido (validação completa)
│       │   ├── onOrderCreated.ts       ← Trigger Firestore: notifica cliente via FCM
│       │   ├── onOrderStatusChanged.ts ← Trigger Firestore: notifica cliente em mudanças de status
│       │   ├── onFilhoStatusChanged.ts ← Trigger Firestore: notifica cliente via pedido_filho
│       │   ├── onPedidoFilhoCriado.ts  ← Trigger Firestore: notifica produtor
│       │   └── acceptDelivery.ts       ← Callable: entregador aceita entrega (transação atômica)
│       ├── webhooks/
│       │   └── mercadoPagoWebhook.ts   ← HTTP trigger: recebe confirmação de pagamento MP
│       ├── payments/
│       │   └── setProducerMpToken.ts   ← Callable: admin registra/remove token MP do produtor
│       ├── notifications/
│       │   └── sendPush.ts             ← Helper: envia FCM para todos os tokens de um uid
│       ├── storage/
│       │   └── uploadProductPhoto.ts   ← Storage trigger: redimensiona/otimiza foto de produto
│       └── index.ts                   ← Exportações centrais de todas as CFs
│
├── docs/                           ← Documentação do projeto
│   ├── arquitetura.md
│   ├── database.md
│   ├── seguranca.md
│   ├── integracoes.md
│   ├── ui-ux.md
│   ├── etapas.md
│   └── apps/ (consumidor, produtor, backoffice, entregador)
│
├── firestore.rules                 ← Regras de segurança Firestore (deny-by-default)
├── firestore.indexes.json          ← 17 índices compostos
├── storage.rules                   ← Regras Cloud Storage
├── firebase.json                   ← Config Firebase CLI
├── turbo.json                      ← Pipeline Turborepo
├── pnpm-workspace.yaml             ← `apps/*` + `packages/*` + `functions`
├── package.json                    ← Scripts globais (dev, build, lint, typecheck)
├── CLAUDE.md                       ← Instruções para Claude Code
└── contexto_ecossistema.md         ← ESTE ARQUIVO
```

---

## 5. Entidades Firestore — Modelagem Completa

### `users/{uid}`

```typescript
interface User {
  uid: string
  email: string
  emailVerified: boolean
  phone?: string
  phoneVerified: boolean
  name: string
  cpf?: string
  birthDate?: Timestamp
  photoUrl?: string

  // Sistema de roles
  role: 'cliente' | 'produtor' | 'admin' | 'entregador' | 'horta'
  produtorIds?: string[]       // IDs das hortas/produtores que o usuário gerencia (role='produtor')
  hortaId?: string             // ID da horta que o responsável gerencia (role='horta')
  approved?: boolean
  approvedAt?: Timestamp
  approvedBy?: string

  // Rastreamento
  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt?: Timestamp
  deletedAt?: Timestamp

  // Cadastro de produtores (para rastrear abandono do wizard)
  registrationSource?: 'produtor'
  registrationStatus?: 'wizard_pending' | 'completed'

  preferences?: {
    notifications: { push: boolean; email: boolean; sms: boolean; promotional: boolean }
  }
}
```

Subcollections:
- `users/{uid}/addresses/{id}` — Endereços de entrega
- `users/{uid}/fcmTokens/{id}` — Tokens FCM (multi-device)
- `users/{uid}/notifications/{id}` — Notificações da plataforma

### `produtores/{id}`

```typescript
interface Produtor {
  id: string
  slug: string                    // ex: "horta-joao-silva" (único, URL-friendly)
  name: string
  description: string
  ownerUid: string

  phone: string
  email?: string
  website?: string
  document?: string               // CPF/CNPJ não formatado

  address: {
    cep: string; street: string; number: string; complement?: string
    neighborhood: string; city: string; state: string
    lat?: number; lng?: number
  }

  logoUrl?: string
  bannerUrl?: string
  isOpen: boolean

  openingHours: Array<{
    dayOfWeek: 0|1|2|3|4|5|6     // 0 = domingo
    open: boolean
    openTime?: string             // "HH:mm"
    closeTime?: string
  }>

  deliveryFeeInCents: number      // SEMPRE em centavos
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number
  estimatedDeliveryTimeMax: number
  deliveryRadiusKm?: number | null

  certifications: Array<'organico'|'agroecologico'|'natural'|'biodynamico'|'sem_agrotoxicos'>
  tags?: string[]                 // ex: ['verduras', 'frutas', 'temperos']

  hortaId?: string | null         // Se pertence a uma horta coletiva
  status: 'pending' | 'approved' | 'suspended' | 'rejected'
  commission: number              // % de comissão da plataforma (0-100)
  mpConnected?: boolean

  approvedAt?: Timestamp; approvedBy?: string
  rejectedAt?: Timestamp; rejectionReason?: string
  createdAt: Timestamp; updatedAt: Timestamp
}
```

Subcollections: `categories/{id}`, `products/{id}`, `stats/{YYYY-MM-DD}`

### `orders/{id}`

```typescript
interface Order {
  id: string
  customerId: string; customerName: string; customerPhone: string
  produtorId: string; produtorName: string; produtorSlug: string
  hortaId?: string                // Novo modelo multi-produtor
  pedidoFilhosCount?: number

  items: Array<{
    productId: string; productName: string
    categoryId: string; categoryName: string
    unit: ProductUnit; priceInCents: number; quantity: number
    photoUrl?: string; notes?: string
  }>

  deliveryAddress: {
    label: string; recipientName: string; phone: string
    cep: string; street: string; number: string; complement?: string
    neighborhood: string; city: string; state: string
  }

  subtotalInCents: number; deliveryFeeInCents: number
  discountInCents: number; totalInCents: number
  couponCode?: string

  payment: {
    method: 'pix' | 'credit_card' | 'debit_card'
    status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
    externalId?: string           // ID da transação no Mercado Pago
    pixQrCodeBase64?: string; pixQrCode?: string
    paidAt?: Timestamp
  }

  status: 'pending'|'confirmed'|'accepted'|'preparing'|'ready'|'on_delivery'|'delivered'|'cancelled'|'refunded'
  statusHistory: Array<{ status: OrderStatus; timestamp: Timestamp; note?: string }>

  deliveryDriverId?: string
  driverLocation?: { lat: number; lng: number }
  driverLocationUpdatedAt?: Timestamp
  notes?: string

  estimatedDeliveryTimeMin: number; estimatedDeliveryTimeMax: number
  createdAt: Timestamp
  confirmedAt?: Timestamp; acceptedAt?: Timestamp; preparingAt?: Timestamp
  readyAt?: Timestamp; onDeliveryAt?: Timestamp
  deliveredAt?: Timestamp; cancelledAt?: Timestamp
}
```

### `pedidos_filhos/{id}`

```typescript
interface PedidoFilho {
  id: string
  pedidoPaiId: string             // Referência ao orders/{id}
  hortaId: string
  produtorId: string; produtorName: string
  customerId: string; customerName: string; customerPhone: string
  deliveryAddress: DeliveryAddress
  status: 'pendente'|'aceito'|'em_preparo'|'separado'|'retirado'|'entregue'|'cancelado'
  valorRepasseInCents: number     // Valor líquido a repassar ao produtor
  items: OrderItem[]
  repassePago?: boolean; repassePagoAt?: Timestamp
  createdAt: Timestamp; updatedAt: Timestamp
}
```

### `hortas/{id}`

```typescript
interface Horta {
  id: string
  name: string; slug: string; description?: string
  address: ProdutorAddress
  logoUrl?: string; bannerUrl?: string
  status: 'active' | 'inactive'
  produtorIds: string[]           // IDs dos Produtores que operam aqui

  deliveryFeeInCents: number
  deliveryFeePerKmInCents?: number // Taxa adicional por km (0 = frete fixo)
  deliveryRadiusKm?: number        // 0/ausente = ilimitado
  minOrderValueInCents: number
  estimatedDeliveryTimeMin: number; estimatedDeliveryTimeMax: number

  lat?: number; lng?: number      // Para cálculo de frete dinâmico

  // Responsável da horta (role='horta') — adicionado recentemente
  ownerUid?: string
  ownerEmail?: string             // Desnormalizado para exibição
  ownerName?: string              // Desnormalizado para exibição

  createdAt: Timestamp; updatedAt: Timestamp
}
```

### Outras Collections

```
coupons/{code}          — Cupons de desconto (% ou fixo, por produtor ou global)
deliveryDrivers/{uid}   — Perfil de entregadores (status, veículo, aprovação)
reviews/{id}            — Avaliações de produtores (1-5 estrelas, comentário)
driver_reviews/{id}     — Avaliações de entregadores
appConfig/{docId}       — Configurações globais da plataforma (singleton)
auditLogs/{id}          — Log imutável de ações administrativas
mp_tokens/{produtorId}  — Tokens Mercado Pago (server-only, inacessível pelo cliente)
```

---

## 6. Sistema de Roles e Custom Claims

### Roles Existentes

| Role | Quem | Custom Claims | App Principal |
|------|------|--------------|---------------|
| `cliente` | Consumidor final | `{role: 'cliente'}` | consumidor |
| `produtor` | Dono de produtor/horta | `{role: 'produtor', produtorIds: ['id1',...], approved: true}` | produtor |
| `admin` | Operador da plataforma | `{role: 'admin'}` | backoffice |
| `entregador` | Motorista | `{role: 'entregador'}` | entregador |
| `horta` | Responsável de horta coletiva | `{role: 'horta', hortaId: 'xxx'}` | horta |

### Fluxo de Aprovação de Produtor

```
1. Usuário cria conta → role='cliente' (via onUserCreated CF)
2. Usuário acessa /configurar → preenche wizard (3 steps)
3. createProdutor() cria doc em produtores/{id} com status='pending'
4. Admin vê no backoffice → clica "Aprovar"
5. setProdutorStatus() + callSetUserRole({role:'produtor', produtorIds:[id], approved:true})
6. CF setUserRole → setCustomUserClaims() + atualiza users/{uid}
7. Usuário força refresh token → getIdTokenResult(true)
8. ProdutorGuard detecta role='produtor' + doc aprovado → acesso liberado
```

### Fluxo de Atribuição de Responsável de Horta

```
1. Admin cria horta no backoffice
2. Admin clica "Responsável" → informa email + nome
3. CF assignHortaManager:
   a. Se usuário NÃO existe → cria Firebase Auth account + doc users/{uid}
   b. Se usuário JÁ existe → verifica se role é compatível
   c. Define claims: {role:'horta', hortaId}
   d. Atualiza users/{uid}: role='horta', hortaId
   e. Atualiza hortas/{id}: ownerUid, ownerEmail, ownerName
   f. Gera passwordResetLink via admin.auth().generatePasswordResetLink()
4. Backoffice exibe o link com botão copiar
5. Admin envia link ao responsável via WhatsApp/Telegram
6. Responsável clica → define senha → acessa marketplace-delivery-horta.netlify.app
```

---

## 7. Cloud Functions — Detalhamento Completo

Todas as CFs v2 em região `southamerica-east1` (São Paulo, Brasil).

### Callables (chamadas pelo cliente autenticado)

| Função | Quem pode chamar | O que faz |
|--------|-----------------|-----------|
| `setUserRole` | Admin | Altera role + custom claims de qualquer usuário; registra em auditLogs |
| `cleanupGhostProdutores` | Admin | Remove contas fantasma de produtores (auth + firestore) |
| `selfRevokeOrphanedClaim` | Qualquer autenticado | Revoga `role='produtor'` se o doc em `produtores` foi deletado |
| `assignHortaManager` | Admin | Cria (se necessário) + vincula usuário como gestor de horta; gera link de acesso |
| `createOrder` | Cliente | Cria pedido completo com validações, frete, cupom, pagamento MP |
| `acceptDelivery` | Entregador | Aceita uma entrega; transação atômica para evitar conflito |
| `setProducerMpToken` | Admin | Armazena token MP no servidor (mp_tokens) |
| `removeProducerMpToken` | Admin | Remove token MP |

### Triggers Firestore

| Função | Trigger | O que faz |
|--------|---------|-----------|
| `onOrderCreated` | `orders/{id}` create | Notifica cliente via FCM |
| `onOrderStatusChanged` | `orders/{id}` update | Notifica cliente quando status muda |
| `onFilhoStatusChanged` | `pedidos_filhos/{id}` update | Notifica cliente via pedido filho |
| `onPedidoFilhoCriado` | `pedidos_filhos/{id}` create | Notifica o produtor específico via FCM |

### Triggers Auth

| Função | Trigger | O que faz |
|--------|---------|-----------|
| `onUserCreated` | Firebase Auth user create | Cria `users/{uid}` com role='cliente'; usa `{merge:true}` para não sobrescrever campos escritos antes do trigger |

### HTTP Triggers

| Função | Método | O que faz |
|--------|--------|-----------|
| `mercadoPagoWebhook` | POST | Recebe webhook MP, valida assinatura HMAC, atualiza `orders/{id}.payment.status` e `status` |

---

## 8. Regras Firestore — Helpers e Permissões

```javascript
// Helpers
isAuthenticated()          → request.auth != null
isAdmin()                  → role == 'admin'
isProducer()               → role == 'produtor'
isDriver()                 → role == 'entregador'
isHortaManager()           → role == 'horta'
isOwnerOfProdutor(id)      → isProducer() && id in request.auth.token.produtorIds
isOwnerOfHorta(id)         → isHortaManager() && request.auth.token.hortaId == id
```

| Collection | Read | Write |
|------------|------|-------|
| `users/{uid}` | Proprietário OU Admin | Proprietário (não pode mudar role/approved) OU Admin |
| `users/{uid}/addresses` | Proprietário | Proprietário |
| `users/{uid}/fcmTokens` | Proprietário | Proprietário |
| `users/{uid}/notifications` | Proprietário | Proprietário (só campo `read`) |
| `produtores/{id}` | Status=approved OU proprietário OU Admin | Create: autenticado (status=pending); Update: proprietário (sem mudar status/commission) OU Admin; Delete: Admin |
| `produtores/{id}/categories` | Todos | Proprietário OU Admin |
| `produtores/{id}/products` | Todos | Proprietário OU Admin |
| `produtores/{id}/stats` | Proprietário OU Admin | Negado (Cloud Function) |
| `orders/{id}` | Cliente OU produtor-dono OU driver (ready) OU Admin | Create: negado (CF only); Update: Admin OU produtor-dono (status) OU driver (status+loc) OU cliente (cancel) |
| `pedidos_filhos/{id}` | Admin OU produtor-dono OU cliente | Create: negado; Update: Admin OU produtor (status) |
| `hortas/{id}` | Todos (público) | Create: Admin; Update: Admin OU gestor-da-horta; Delete: Admin |
| `coupons/{code}` | Autenticado | Admin |
| `deliveryDrivers/{id}` | Proprietário OU Admin | Create: autenticado (status=pending_approval); Update: driver (sem status/approved) OU Admin |
| `reviews/{id}` | Todos | Create: autenticado (autor=self); Update: Admin (soft delete) |
| `driver_reviews/{id}` | Todos | Create: autenticado; Update: Admin |
| `appConfig/{id}` | Todos | Admin |
| `auditLogs/{id}` | Admin | Negado |
| `mp_tokens/{id}` | Negado | Negado |

---

## 9. Rotas de Cada App

### App Consumidor (`/`)

```
(auth) — sem autenticação
  /login               Email/senha ou Google
  /cadastro            Registro de novo cliente
  /recuperar-senha     Reset de senha
  /acesso-negado       Fallback de role incorreto

(main) — requer role=cliente
  /                    Home: lista de hortas e produtores próximos
  /horta/[slug]        Catálogo completo de uma horta (todos os produtores)
  /produtor/[slug]     Catálogo de produtor individual
  /busca               Busca com filtros (categoria, certificação, cidade)
  /checkout            Endereço de entrega + método de pagamento + confirmar
  /pedido/[id]         Acompanhamento em tempo real + rastreamento entregador
  /pedidos             Histórico de pedidos
  /perfil              Editar dados + endereços + notificações + sair
```

### App Produtor (`/`)

```
(auth) — sem autenticação
  /login
  /cadastro            Registro com email + dados básicos
  /recuperar-senha
  /acesso-negado
  /aguardando-aprovacao Spinner + polling até admin aprovar

(setup) — autenticado, sem role=produtor
  /configurar          Wizard 3 steps: dados básicos / endereço / horários

(dashboard) — requer role=produtor
  /                    Dashboard: KPIs do dia (pedidos, faturamento, ticket médio)
  /pedidos             Kanban: Novos → Aceitos → Preparando → Prontos → Em entrega
  /pedidos/historico   Histórico filtrado por período (7/30/90d)
  /catalogo            CRUD categorias + produtos com drag-to-reorder
  /configuracoes       Editar perfil, horários, taxas, certificações, MP
  /relatorios          Exportar CSV: KPIs, top produtos, pedidos por período
```

### App Backoffice (`/`)

```
(auth)
  /login

(dashboard) — requer role=admin
  /                    KPIs globais: GMV, pedidos, produtores ativos
  /produtores          Listagem com tabs (Pendentes/Aprovados/Suspensos/Rejeitados)
  /produtores/[id]     Detalhe: dados, comissão, MP token, histórico
  /hortas              CRUD hortas + modal "Responsável" (criar conta + gerar link)
  /pedidos             Todos os pedidos da plataforma + filtros
  /cupons              CRUD cupons (global ou por produtor)
  /entregadores        Listagem + aprovação/suspensão de drivers
  /financeiro          Faturamento por produtor, comissões, repasses
  /avaliacoes          Reviews com soft delete
  /registros-incompletos Contas fantasma de produtores (cleanup)
  /configuracoes       Config global: nome, email, comissão padrão
```

### App Entregador (`/`)

```
(auth)
  /login
  /cadastro            Dados: nome, CPF, veículo, placa, foto
  /configurar          Setup pós-cadastro
  /aguardando-aprovacao Polling de aprovação admin
  /acesso-negado

(dashboard) — requer role=entregador
  /                    Lista de pedidos com status='ready' disponíveis
  /entrega/[id]        Detalhe: cliente, itens, mapa, botão confirmar entrega
  /historico           Histórico de entregas por período
  /ganhos              Resumo financeiro de ganhos
```

### App Horta (`/`) — NOVO

```
(auth)
  /login               Apenas login (sem cadastro público — criação é feita pelo admin)
  /acesso-negado

(dashboard) — requer role=horta + hortaId nas claims
  /                    Dashboard: stats da horta (produtores, taxa, pedido mínimo, tempo)
  /minha-horta         Formulário para editar dados da horta (nome, endereço, entrega, status)
  /produtores          Lista dos produtores vinculados à horta (read-only)
```

---

## 10. Estado Atual de Desenvolvimento

### ✅ Implementado e Operacional

#### Autenticação e Segurança
- Firebase Auth com email/senha em todos os apps
- Custom claims multi-role (`cliente`, `produtor`, `admin`, `entregador`, `horta`)
- Guards client-side com force-refresh de token antes de decisões de roteamento
- Firestore security rules deny-by-default com helpers de role
- Self-revoke de claim corrompido (`selfRevokeOrphanedClaim`)
- Cleanup de contas fantasma de produtor (`cleanupGhostProdutores`)
- Prevenção de login de produtores deletados (ProdutorGuard verifica doc)
- Sistema completo de criação e vinculação de responsável de horta

#### Catálogo e Navegação
- Listagem de hortas e produtores na home do consumidor
- Página de horta com todos os produtores e seus produtos
- Página individual de produtor com catálogo completo
- Busca por nome, categoria, cidade, certificação
- Filtros de disponibilidade (isOpen, deliveryRadius)
- Suporte a múltiplas unidades de produto (kg, g, unidade, maço, dúzia, etc.)

#### Carrinho e Checkout
- Carrinho persistido em localStorage (um produtor/horta por vez)
- Checkout com seleção/criação de endereço de entrega
- Cálculo de frete dinâmico via fórmula Haversine + Nominatim
- Aplicação de cupons de desconto (% ou valor fixo)
- Pagamento via Mercado Pago (PIX com QR Code + cartão de crédito)
- Webhook MP com validação HMAC
- Criação de pedido via Cloud Function (validação server-side completa)

#### Gestão de Pedidos
- Kanban em tempo real no app produtor (4 colunas)
- Alertas sonoros (Web Audio API, 3 bipes) para novos pedidos
- Impressão de comanda térmica 72mm
- Acompanhamento em tempo real pelo consumidor
- Sistema de pedidos filhos (multi-produtor em horta)
- Histórico com filtros por período

#### Entregadores
- Cadastro e aprovação de drivers
- Lista de entregas disponíveis (pedidos com status='ready')
- Aceitação atômica (transação Firestore para evitar conflito)
- Atualização de localização do driver
- Confirmação de entrega

#### Backoffice Admin
- Dashboard KPIs globais
- Aprovação/rejeição/suspensão de produtores com motivo
- Edição de comissão por produtor
- Integração Mercado Pago por produtor (token management)
- CRUD completo de hortas
- Modal de responsável de horta (criar conta + gerar link de acesso)
- CRUD de cupons globais e por produtor
- Financeiro: faturamento, repasses, comissões
- Listagem e moderação de reviews
- Gestão de entregadores
- Limpeza de registros incompletos

#### App Responsável de Horta (NOVO)
- Login exclusivo (conta criada pelo admin, sem auto-cadastro)
- Dashboard com stats da horta em tempo real
- Edição de dados da horta (nome, descrição, endereço, configurações de entrega, status ativo/inativo)
- Visualização dos produtores vinculados
- Guard com verificação de `role='horta'` + `hortaId` nas claims
- Subscrição em tempo real via `onSnapshot`

#### Infraestrutura
- Monorepo Turborepo com cache de build
- 5 apps deployados no Netlify com auto-deploy via GitHub
- Cloud Functions v2 em southamerica-east1
- Firestore rules + índices deployados
- Firebase Cloud Messaging (push notifications)
- PWA em todos os apps (Service Worker, instalável)

---

## 11. Pendências e Próximos Passos

### Integração com App de Carbono/Compostagem
- O projeto `compostroca` / `compostroca-esg` existe no Netlify mas não está integrado
- Possível integração: score ESG na página do produtor, relatório no backoffice
- Mecanismo sugerido: Cloud Function periódica que puxa dados do compostroca e atualiza `produtores/{id}.esgScore`

### Funcionalidades de Negócio Pendentes
- **Avaliação pós-pedido**: UI no consumidor para avaliar após entrega (lógica parcial existe)
- **Cupons por produtor**: CRUD existe mas UI do backoffice precisa de filtro por produtor
- **GPS real-time do entregador**: Campo `driverLocation` existe no Firestore mas UI de mapa no consumidor é básica
- **Chat produtor-cliente**: Não implementado
- **Relatórios do backoffice**: Gráficos de KPIs (GMV por período, taxa de cancelamento, etc.)
- **Recuperação de senha**: Páginas existem mas podem estar incompletas em alguns apps

### Melhorias Técnicas
- **Testes automatizados**: Zero cobertura atualmente (unidade, integração, E2E)
- **Rate limiting nas CFs**: `createOrder` e `assignHortaManager` não têm throttle
- **Paginação no backoffice**: Listas grandes sem paginação/cursor (impacto em produção)
- **Emuladores Firebase documentados**: Setup local pode exigir configuração manual
- **`.env.local` do backoffice**: Não existe localmente; precisa ser criado para dev local
- **Domínio customizado**: Todos os apps ainda no subdomínio `.netlify.app`
- **Mercado Pago produção**: `MERCADO_PAGO_ACCESS_TOKEN` configurado para sandbox; precisa token real

### App Horta — Funcionalidades Futuras
- Upload de logo e banner da horta
- Gestão de pedidos filhos (ver pedidos que chegaram na horta)
- Relatórios de vendas por produtor
- Comunicação com produtores da horta

---

## 12. Variáveis de Ambiente

### Por App (`.env.local` em cada `apps/<nome>/`)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=marketplace-delivery-dev
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=marketplace-delivery-dev.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=188663565238
NEXT_PUBLIC_FIREBASE_APP_ID=1:188663565238:web:42a516267c6102cf40cf17
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=dwp8arsws
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=marketplace_produtos
# Apenas consumidor:
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=
```

### Cloud Functions (Firebase Secret Manager)

```
MERCADO_PAGO_ACCESS_TOKEN
MERCADO_PAGO_WEBHOOK_SECRET
```

---

## 13. Convenções Críticas

| Aspecto | Convenção |
|---------|-----------|
| Valores monetários | **Sempre em centavos (inteiros)** no banco. Converter para R$ apenas na UI. |
| Datas | **Sempre `Timestamp` do Firestore**. Nunca `Date` ou `Date.now()` no banco. `serverTimestamp()` para created/updated. |
| Acesso a Firestore | **Sempre via `packages/shared-services`**. Nunca chamar Firebase diretamente de componentes React. |
| Tempo real | `onSnapshot()` do Firestore para tudo que precisa atualizar sem reload. |
| Pedidos | **Apenas via CF `createOrder`**. Regras Firestore bloqueiam create direto do cliente. |
| Middleware Next.js | Arquivo se chama `proxy.ts` (não `middleware.ts` — breaking change Next.js 16). |
| TypeScript | `strict: true`. Sem `any` sem justificativa. Type imports (`import type`). |
| Tailwind | Config em `globals.css` via `@theme`. Sem `tailwind.config.js/ts`. |
| Commits | PT-BR, imperativo, ≤72 chars. |

---

## 14. IDs e Identificadores Importantes

| Recurso | Valor |
|---------|-------|
| Firebase Project ID | `marketplace-delivery-dev` |
| GitHub Repo | `https://github.com/Dnotcwb/marketplace-delivery` |
| Netlify Team Slug | `dnotcwb` |
| Netlify - consumidor | `cf987a8f-3629-49fb-8788-e8f736c65267` |
| Netlify - produtor | `2ff61d89-1b9a-40ed-9537-d68f7f61d7b7` |
| Netlify - backoffice | `f57985ad-1c5b-4af6-abe6-9b69080c9888` |
| Netlify - entregador | `a9fe63ee-c03c-4434-9483-02e3a9cb6f4c` |
| Netlify - horta | `84e3338f-d147-4e38-aded-ee3a78abf336` |
| CF Region | `southamerica-east1` |
| Cloudinary Cloud | `dwp8arsws` |
| Cloudinary Preset | `marketplace_produtos` |

---

*Documento gerado em 2026-06-07. Reflete o estado do commit mais recente em `main`.*
