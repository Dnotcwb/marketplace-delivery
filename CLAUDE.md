# Marketplace de Delivery — Plataforma Multi-App estilo iFood

## Sobre o Projeto

Plataforma de delivery multi-vendor inspirada em iFood / 99Food / Rappi, construída como **monorepo com 4 aplicações separadas** compartilhando um único backend Firebase. Foco inicial em pequenas e médias operações, com arquitetura preparada para escalar.

## Arquitetura — Os 4 Apps

Cada público tem necessidades opostas, então cada um tem seu próprio app:

| App | Público | Característica principal | Status |
|-----|---------|--------------------------|--------|
| **consumidor** | Cliente final | Mobile-first, leve, SEO pesado, PWA | Etapas 1-3, 6 |
| **produtor** | Restaurante / lojista | PWA, áudio de alerta, impressão de comanda, sempre aberto | Etapas 2, 4 |
| **backoffice** | Administradores da plataforma | Desktop-first, denso em dados, dashboards | Etapa 5 |
| **entregador** | Motoboy / entregador | PWA com GPS (React Native no futuro) | Etapa 6 |

**Os 4 apps consomem o mesmo Firebase** — uma única instância de Firestore, um único projeto Firebase, regras de segurança unificadas. O que muda é o frontend e o que cada app pode acessar (controlado por regras Firestore + custom claims no Firebase Auth).

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend (todos os apps):** Next.js 15 (App Router), React 18, TailwindCSS, TypeScript estrito
- **Backend:** Firebase (Authentication, Firestore, Storage, Cloud Functions)
- **Hospedagem:** Netlify (um site por app, build automático via GitHub)
- **Pagamentos:** Mercado Pago (PIX + cartão, com webhook em Cloud Functions)
- **Fiscal:** Preparação para Focus NFe (não implementar agora — só estrutura de dados)
- **PWA:** `next-pwa` em todos os 4 apps

## Estrutura do Monorepo

```
marketplace-delivery/
├── apps/
│   ├── consumidor/          # Next.js — cliente final
│   ├── produtor/            # Next.js — restaurantes
│   ├── backoffice/          # Next.js — admin da plataforma
│   └── entregador/          # Next.js (PWA) — motoboys (Etapa 6)
├── packages/
│   ├── shared-types/        # interfaces TS (Pedido, Restaurante, Produto, etc.)
│   ├── shared-firebase/     # config Firebase Web SDK + helpers
│   ├── shared-ui/           # design system (Button, Card, Input, Modal)
│   ├── shared-services/     # CRUD do Firestore, lógica de negócio
│   ├── shared-utils/        # funções puras (formatadores, cálculos, validações)
│   └── shared-config/       # ESLint, Prettier, tsconfig compartilhados
├── functions/               # Firebase Cloud Functions
│   ├── webhooks/            # Mercado Pago, futuras integrações
│   ├── triggers/            # onCreate de pedidos, etc.
│   └── scheduled/           # tarefas agendadas
├── firestore.rules          # regras únicas — únicas para todos os apps
├── firestore.indexes.json   # índices compostos
├── storage.rules            # regras do Cloud Storage
├── firebase.json            # config do Firebase CLI
├── turbo.json               # config do Turborepo
├── pnpm-workspace.yaml      # config do pnpm
├── package.json             # scripts globais
└── CLAUDE.md                # este arquivo
```

## Comandos Globais (rodam na raiz)

```bash
# Setup
pnpm install                       # instala dependências de todos os apps/packages

# Desenvolvimento
pnpm dev                           # roda todos os apps em paralelo
pnpm dev --filter=consumidor       # roda apenas um app
pnpm dev --filter=produtor

# Build
pnpm build                         # build de todos
pnpm build --filter=consumidor     # build de um app específico

# Qualidade
pnpm lint                          # ESLint em todo o monorepo
pnpm typecheck                     # TS check em todo o monorepo
pnpm test                          # testes (quando configurado)
pnpm format                        # Prettier

# Firebase
pnpm firebase:emulators            # roda emuladores locais (auth, firestore, functions)
pnpm firebase:deploy:rules         # deploy só das regras
pnpm firebase:deploy:functions     # deploy só das functions
```

Portas de dev padrão:
- **consumidor:** 3000
- **produtor:** 3001
- **backoffice:** 3002
- **entregador:** 3003
- **Firebase emulators UI:** 4000

## Estrutura Padrão Dentro de Cada App

```
apps/<nome-do-app>/
├── src/
│   ├── app/             # App Router do Next.js
│   ├── components/      # componentes específicos deste app
│   ├── hooks/           # custom hooks específicos deste app
│   ├── contexts/        # React contexts (Auth, etc.)
│   └── lib/             # utilitários específicos deste app
├── public/              # estáticos (incluindo manifest PWA, ícones)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json        # extends do shared-config
└── package.json
```

**Regra de ouro:** se alguma coisa serve a 2+ apps, vai para `packages/`. Se serve só àquele app, fica em `apps/<nome>/`.

## Convenções de Código

- **TypeScript estrito sempre.** Nada de `any` sem justificativa explícita comentada.
- **Server Components por padrão** no App Router; Client Components apenas quando há interatividade (`'use client'` no topo).
- Nomes em PT-BR para domínio de negócio (`Pedido`, `Restaurante`, `Cupom`); infra fica em EN (`fetchOrder`, `signIn`).
- Arquivos: componentes em `PascalCase.tsx`, hooks em `useNomeDoHook.ts`, utilitários em `kebab-case.ts`.
- **Toda chamada ao Firestore passa por `packages/shared-services/`** — nunca chamar Firebase diretamente de componentes.
- Validação de inputs com **Zod**, formulários com **React Hook Form**.
- **Valores monetários sempre em centavos (int)** para evitar erros de ponto flutuante.
- Datas: sempre `Timestamp` do Firestore no banco; converter para `Date` só na UI.

## Workflow Esperado

1. **Sempre comece em Plan Mode** (`Shift+Tab` 2x no CLI) para tarefas que envolvam mais de 1-2 arquivos.
2. **Leia `docs/etapas.md` no início de cada sessão** para saber em que ponto o projeto está.
3. Para tarefas que tocam um app específico, leia também `docs/apps/<nome-do-app>.md`.
4. Para tarefas no Firestore, leia `docs/database.md` e `docs/seguranca.md`.
5. **Ao concluir uma etapa**, atualize a seção "Status Atual" deste arquivo e o `docs/etapas.md`.
6. **Sempre rode `pnpm lint` e `pnpm typecheck`** antes de marcar tarefa como concluída.
7. **Commits em português, no imperativo**, ≤72 caracteres. Use prefixo do app quando aplicável:
   - `consumidor: cria página de checkout`
   - `produtor: implementa dashboard de pedidos`
   - `shared: adiciona tipo Pedido`
   - `infra: configura Turborepo`

## Princípios Inegociáveis

- **Nunca eliminar funcionalidades** para simplificar — se algo está difícil, sugerir alternativa antes de remover.
- **Nunca remover linhas de código** sem certeza de que a lógica/sintaxe está incorreta.
- **Sugerir melhorias antes de alterar** quando tiver opinião sobre o código existente.
- **Mobile-first no consumidor; desktop-first no backoffice.** Produtor e entregador são PWA mobile/tablet.
- **Segurança não é opcional.** Cada nova collection precisa de regras Firestore antes de ir para produção. Custom claims controlam roles.
- **Performance importa.** Lazy loading, `next/image`, code-splitting natural do Next.js, cache do Turborepo.
- **Sincronização em tempo real.** O Firestore tem listeners nativos — usar `onSnapshot` para qualquer dado que precise atualizar ao vivo (pedidos no produtor, status no consumidor, etc.).

## Roles e Custom Claims

O Firebase Auth recebe uma custom claim `role` que pode ser:

- `cliente` — usa o app consumidor
- `produtor` — usa o app produtor (vinculado a um ou mais `restaurantId`)
- `admin` — usa o backoffice
- `entregador` — usa o app entregador

A claim é setada via Cloud Function quando o usuário é aprovado. **Sem claim, o usuário é tratado como `cliente` por padrão.** As regras do Firestore conferem essa claim para autorizar operações.

## Status Atual

**Etapa 1 — Base do Projeto** (em andamento)

### Etapa 0 ✅
- [x] Documentação inicial criada

### Etapa 1 — progresso
- [x] Monorepo inicializado (Turborepo + pnpm workspaces)
- [x] Apps Next.js 16 criados (consumidor:3000, produtor:3001, backoffice:3002)
- [x] Packages compartilhados criados (shared-types, shared-firebase, shared-ui, shared-services, shared-utils, shared-config)
- [x] Projeto Firebase criado (marketplace-delivery-dev)
- [x] Firebase CLI configurado
- [x] AuthProvider + useAuth + useRequireRole em shared-services
- [x] Cloud Functions: onUserCreated + setUserRole
- [x] firestore.rules (deny-by-default, todas as collections)
- [x] firestore.indexes.json (índices críticos)
- [x] storage.rules
- [x] .env.local nos 3 apps com credenciais Firebase dev
- [x] Páginas de login/cadastro no consumidor
- [x] proxy.ts (proteção de rotas) nos 3 apps
- [x] Commit inicial + tag etapa-1-base
- [ ] Habilitar Auth/Firestore/Storage no console Firebase
- [ ] Repositório GitHub criado e push
- [ ] Netlify conectado (3 sites)

### Stack efetiva (atualizada)
- Next.js: **16.2.6** (mais novo que o planejado — Turbopack ativo)
- React: **19.2.4**
- Tailwind: **4.x** (configuração via CSS @theme, sem tailwind.config.ts)
- pnpm: **11.1.3**
- Turbo: **2.9.14**
- Node: **24.15.0** (supera requisito mínimo de 22)
- proxy.ts: renomeado de middleware.ts (breaking change do Next.js 16)

> **Importante:** Atualize esta seção ao fim de cada etapa concluída.

## Documentação Detalhada

Antes de mexer em qualquer área, leia o documento correspondente:

### Visão geral

- **[docs/arquitetura.md](docs/arquitetura.md)** — Decisões arquiteturais, monorepo, Firebase compartilhado, custom claims.
- **[docs/etapas.md](docs/etapas.md)** — Roadmap completo das 6 etapas e critérios de conclusão.
- **[docs/setup-inicial.md](docs/setup-inicial.md)** — Passo a passo para criar o monorepo do zero.

### Por app

- **[docs/apps/consumidor.md](docs/apps/consumidor.md)** — Funcionalidades, fluxos, telas do app do cliente.
- **[docs/apps/produtor.md](docs/apps/produtor.md)** — Funcionalidades, fluxos, telas do app do restaurante.
- **[docs/apps/backoffice.md](docs/apps/backoffice.md)** — Funcionalidades, fluxos, telas do admin.
- **[docs/apps/entregador.md](docs/apps/entregador.md)** — Funcionalidades, fluxos, telas do entregador (Etapa 6).

### Camadas transversais

- **[docs/database.md](docs/database.md)** — Modelagem do Firestore: collections, campos, relacionamentos, índices.
- **[docs/seguranca.md](docs/seguranca.md)** — Regras Firestore, autenticação, custom claims, proteção de rotas.
- **[docs/integracoes.md](docs/integracoes.md)** — Mercado Pago, Focus NFe, Netlify, Firebase, deploy.
- **[docs/ui-ux.md](docs/ui-ux.md)** — Design system compartilhado, estilo visual, componentes, responsividade.

## Variáveis de Ambiente

Cada app tem seu próprio `.env.local` (nunca commitar). Mais detalhes em `docs/integracoes.md`.

**Apps web (`NEXT_PUBLIC_*` vão para o bundle, são públicos):**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_APP_URL=http://localhost:3000  # ajusta por app
NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY=        # só no consumidor
```

**Cloud Functions (server-side, nunca expostos):**

```bash
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
```

## Postura do Claude Code Neste Projeto

Você atua como **arquiteto de software + dev full-stack sênior + especialista em Firebase, Next.js, monorepos (Turborepo) e UX**.

Seja didático nas decisões — o desenvolvedor tem forte experiência em TI/infraestrutura mas é intermediário em programação moderna. Sempre:

- Explique o "porquê" das decisões, não só o "como"
- Gere código completo e comentado, nunca trechos pela metade
- Diga em qual app/package o arquivo deve ficar
- Liste as dependências exatas que precisam ser instaladas e o comando `pnpm add`
- Avise quando uma mudança afeta múltiplos apps (ex: mexer em `shared-types` impacta os 3 apps)
- Rode `pnpm lint` e `pnpm typecheck` antes de declarar tarefa concluída

Nunca:

- Gere respostas superficiais
- Omita arquivos importantes
- Ignore segurança, escalabilidade, responsividade ou performance
- Duplique código entre apps quando ele deveria estar em `packages/`
