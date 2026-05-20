# Roadmap de Etapas

Este documento descreve as **6 etapas de desenvolvimento** e seus critérios de conclusão. Sempre consulte antes de começar uma sessão para saber em que ponto o projeto está.

> **Como usar este documento:**
> - Cada etapa tem um escopo claro e um critério de "feita"
> - Marcar checkboxes conforme conclui
> - Nunca pular para a próxima etapa sem concluir a anterior
> - Cada etapa deve terminar com `pnpm lint && pnpm typecheck` verde e um commit limpo

---

## Etapa 1 — Base do Projeto

**Objetivo:** Ter o monorepo configurado, os 3 apps rodando e o Firebase plugado.

**Escopo:**

- [ ] Monorepo Turborepo + pnpm (ver `docs/setup-inicial.md` passo a passo)
- [ ] 3 apps Next.js criados (consumidor, produtor, backoffice)
- [ ] 6 packages compartilhados criados como esqueleto
- [ ] Firebase configurado:
  - [ ] Projeto Firebase criado no console
  - [ ] Authentication habilitado (Email/Password + Google)
  - [ ] Firestore criado (modo production)
  - [ ] Storage habilitado
  - [ ] Cloud Functions configurado (TypeScript)
  - [ ] Emuladores rodando localmente
- [ ] **Layout principal de cada app:**
  - [ ] Consumidor: header com logo + busca + carrinho, footer simples
  - [ ] Produtor: sidebar com menu + topbar com perfil
  - [ ] Backoffice: sidebar admin + topbar
- [ ] **Autenticação base:**
  - [ ] Página de login no consumidor (email/senha + Google)
  - [ ] Página de login no produtor (email/senha apenas)
  - [ ] Página de login no backoffice (email/senha + 2FA preparado)
  - [ ] Cloud Function que seta custom claims (`role`)
  - [ ] Context `AuthProvider` em `shared-services` consumido pelos 3 apps
  - [ ] Middleware de rota protegida em cada app
- [ ] **Banco inicial:**
  - [ ] Collection `users` modelada e com regras
  - [ ] Tipos `User`, `UserRole` em `shared-types`
- [ ] Repositório GitHub criado e populado
- [ ] 3 sites criados na Netlify

**Critério de conclusão:** Eu consigo criar uma conta no consumidor, fazer login, ver meu perfil; e o admin (criado manualmente no console) consegue entrar no backoffice.

---

## Etapa 2 — Produtores e Produtos

> **Domínio:** Neste sistema não há restaurantes. Os vendedores são **produtores** (hortas, agricultores, produtores orgânicos). A entidade principal é `Produtor` (coleção `produtores` no Firestore). Produtos são o que cada horta oferece (Verduras, Frutas, Temperos, Laticínios, etc.).

**Objetivo:** Produtores conseguem se cadastrar, criar seu perfil de horta, adicionar produtos. Consumidores conseguem navegar e buscar.

**Escopo:**

### No app produtor:

- [ ] Wizard de criação do perfil de produtor (horta):
  - [ ] Dados básicos (nome da horta, CPF/CNPJ, telefone, descrição)
  - [ ] Endereço (localização da horta)
  - [ ] Foto + banner da horta (upload no Storage)
  - [ ] Horário de disponibilidade para pedidos (por dia da semana)
  - [ ] Taxa de entrega (fixa ou por distância)
  - [ ] Valor mínimo de pedido
  - [ ] Tempo estimado de entrega
  - [ ] Certificações (Orgânico, Agroecológico, etc.)
- [ ] CRUD de categorias de produtos (Verduras, Frutas, Legumes, Temperos, Laticínios, etc.)
- [ ] CRUD de produtos:
  - [ ] Nome, descrição, preço (em centavos!)
  - [ ] Foto (Storage)
  - [ ] Categoria, unidade de medida (kg, g, unidade, maço, dúzia, litro)
  - [ ] Disponibilidade e estoque
  - [ ] Certificação orgânica por produto
- [ ] Controle de estoque básico (toggle "esgotado" + quantidade)
- [ ] Status do produtor: aceitando pedidos / pausado (manual + automático por horário)

### No app consumidor:

- [ ] Home com listagem de produtores/hortas (cards modernos)
- [ ] Filtro por categoria de produto (Verduras, Frutas, Orgânicos...)
- [ ] Busca com debounce (nome do produtor ou produto)
- [ ] Página do produtor (`/produtor/[slug]`) com:
  - [ ] Banner + foto + info da horta
  - [ ] Status (disponível/indisponível, tempo de entrega, taxa)
  - [ ] Catálogo agrupado por categoria
  - [ ] Click no produto abre modal com detalhes
- [ ] Geolocalização (pedir permissão, mostrar só produtores na área)

### No backoffice:

- [ ] Lista de produtores pendentes de aprovação
- [ ] Aprovar/rejeitar produtor (seta custom claim `approved: true` + `produtorIds`)
- [ ] Visualizar dados completos do produtor

### Compartilhado:

- [ ] Tipos: `Produtor`, `Product`, `Category` em `shared-types`
- [ ] Services: `produtorService`, `productService` em `shared-services`
- [ ] Regras Firestore já atualizadas para `produtores`, `products`, `categories`
- [ ] Índices Firestore (por geolocalização, por categoria)

**Critério de conclusão:** Um produtor pode se cadastrar, ser aprovado pelo admin, montar um catálogo completo, e o consumidor consegue ver esse produtor e seus produtos.

---

## Etapa 3 — Carrinho, Checkout e Pagamento

**Objetivo:** Consumidor consegue finalizar pedido com pagamento real (sandbox do Mercado Pago).

**Escopo:**

### No app consumidor:

- [ ] Context `CartProvider` em `shared-services` (mas instanciado no consumidor)
- [ ] Adicionar/remover/alterar quantidade de produtos no carrinho
- [ ] Carrinho persistido em `localStorage` (não-logado) e Firestore (logado)
- [ ] **Restrição:** carrinho só aceita produtos de **um** produtor por vez (igual iFood)
- [ ] Sidebar/modal de carrinho com resumo
- [ ] Tela de checkout:
  - [ ] Selecionar endereço de entrega (CRUD de endereços)
  - [ ] Selecionar forma de pagamento (PIX ou cartão)
  - [ ] Aplicar cupom de desconto (validação básica)
  - [ ] Resumo: subtotal + taxa de entrega + desconto = total
  - [ ] Botão "Finalizar pedido"
- [ ] Integração Mercado Pago:
  - [ ] PIX: gera QR code, exibe na tela, polling de status
  - [ ] Cartão: Brick de pagamento do Mercado Pago (tokenização no client)
- [ ] Tela de acompanhamento do pedido (real-time via `onSnapshot`):
  - [ ] Status visual (timeline: confirmado → preparando → saiu → entregue)
  - [ ] Detalhes do pedido
  - [ ] Tempo estimado

### Em Cloud Functions:

- [ ] Function `createOrder` (callable):
  - [ ] Valida carrinho, cupom, endereço
  - [ ] Calcula totais no server (não confiar no client)
  - [ ] Cria documento em `orders/` com status `pending`
  - [ ] Cria preferência de pagamento no Mercado Pago
  - [ ] Retorna ID do pedido e dados de pagamento
- [ ] Function `mercadoPagoWebhook` (HTTP):
  - [ ] Recebe notificação do Mercado Pago
  - [ ] Valida assinatura (segurança crítica)
  - [ ] Atualiza status do pedido para `confirmed`
  - [ ] Dispara notificação para o produtor (Etapa 4)
- [ ] Function `onOrderCreated` (Firestore trigger):
  - [ ] Loga evento, atualiza contadores agregados

### No backoffice (mínimo):

- [ ] Listagem de pedidos com filtros
- [ ] Detalhes do pedido (visualização)

### Compartilhado:

- [ ] Tipos: `Order`, `OrderItem`, `OrderStatus`, `Payment`, `Address`, `Coupon`
- [ ] Service: `orderService`, `paymentService`, `addressService`
- [ ] Util: `calculateOrderTotal`, `formatCurrency` (centavos → "R$ XX,XX")
- [ ] Regras Firestore para `orders`, `addresses`, `payments`, `coupons`
- [ ] Índices: pedidos por usuário + status + data

**Critério de conclusão:** Eu, como consumidor, consigo fazer um pedido completo, pagar via PIX no sandbox, e ver o status mudar para "confirmado" automaticamente após o webhook.

---

## Etapa 4 ✅ — Gestão de Pedidos (Produtor) (concluída)

**Objetivo:** O produtor recebe pedidos em tempo real, gerencia status, vê dashboard.

### No app produtor:

- [x] Tela "Pedidos" como Kanban com 4 colunas: Novos / Em preparo / Prontos / Em entrega
- [x] Card de pedido com dados resumidos (cliente, itens, total, tempo decorrido)
- [x] Clique no card abre modal de detalhes completo
- [x] Listener `onSnapshot` para atualização ao vivo
- [x] Alerta sonoro (Web Audio API — 3 bipes em 1050 Hz) com desbloqueio na primeira interação
- [x] Highlight visual (anel âmbar) em novos pedidos por 10s via docChanges()
- [x] Botões de avanço de status: Confirmar → Aceitar → Iniciar preparo → Pronto → Saiu p/ entrega → Entregue
- [x] Cancelar pedido (com confirmação)
- [x] Modal de detalhes: cliente, telefone, itens + obs, endereço, valores, pagamento, ações
- [x] Imprimir comanda via `window.print()` com CSS @media print (layout térmico 72mm)
- [x] Dashboard com KPIs reais (onSnapshot): pedidos hoje, faturamento, ticket médio, pedidos ativos
- [x] Top 5 produtos mais vendidos no dia
- [x] Histórico de pedidos com busca (id/cliente/produto) e filtro por status
- [x] Relatórios CSV exportáveis (7/30/90 dias): KPIs + top 10 produtos + tabela completa de pedidos
- [x] Configurações da horta (/configuracoes): dados básicos + operação com salvamento independente por seção

### Em Cloud Functions:

- [x] Function `onOrderStatusChanged` (Firestore trigger v2, região southamerica-east1)
  - [x] Grava notificação em `users/{customerId}/notifications` a cada mudança de status
- [ ] Function `dailyStatsAggregator` (scheduled) — postergado para Etapa 5+

### No app consumidor:

- [x] `NotificationBell` no Header: badge de não lidas, dropdown real-time, marcar como lida / marcar todas

**Critério de conclusão:** ✅ Produtor recebe alerta sonoro + visual ao chegar pedido. Mudanças de status são refletidas em tempo real no consumidor (tracking page + notificações).

---

## Etapa 5 — Administração (Backoffice)

**Objetivo:** Painel administrativo profissional para gerenciar a plataforma.

**Escopo:**

### No app backoffice:

- [ ] **Dashboard principal:**
  - [ ] KPIs do dia: pedidos, GMV, novos cadastros, produtores ativos
  - [ ] Gráfico de pedidos últimos 30 dias
  - [ ] Gráfico de receita (taxa da plataforma) últimos 30 dias
  - [ ] Top 10 produtores por faturamento
  - [ ] Mapa de calor por região (futuro)
- [ ] **Gestão de Usuários:**
  - [ ] Lista paginada com busca, filtros (role, status)
  - [ ] Detalhes do usuário (pedidos, endereços, gastos)
  - [ ] Suspender / reativar conta
- [ ] **Gestão de Produtores:**
  - [ ] Lista com filtros (aprovado, suspenso, categoria)
  - [ ] Aprovar / suspender produtor
  - [ ] Editar taxas de comissão por produtor
  - [ ] Forçar abertura/fechamento manual
- [ ] **Gestão de Pedidos:**
  - [ ] Lista global com filtros pesados
  - [ ] Intervir em pedido (cancelar, estornar)
  - [ ] Ver histórico de status de qualquer pedido
- [ ] **Gestão Financeira:**
  - [ ] Faturamento por produtor
  - [ ] Comissões da plataforma
  - [ ] Repasses pendentes
  - [ ] Estornos
- [ ] **Gestão de Cupons:**
  - [ ] CRUD de cupons (código, valor, % ou fixo, validade, uso máx, restrições)
  - [ ] Estatísticas de uso
- [ ] **Controle de Taxas:**
  - [ ] Taxa padrão da plataforma (% sobre o pedido)
  - [ ] Taxa de entrega mínima/máxima
- [ ] **Relatórios:**
  - [ ] Receita por período
  - [ ] Pedidos por categoria
  - [ ] Exportação CSV/XLSX

### Em Cloud Functions:

- [ ] Function `setUserRole` (callable, restrita a admin):
  - [ ] Permite admin promover/rebaixar usuários
- [ ] Function `cancelOrder` (callable, restrita a admin):
  - [ ] Cancela pedido + estorna pagamento via Mercado Pago API

### Compartilhado:

- [ ] Components em `shared-ui`: `DataTable`, `Chart`, `StatCard`, `DateRangePicker`
- [ ] Tipos: `AdminStats`, `Commission`, `Payout`

**Critério de conclusão:** O admin consegue ter visão completa da operação, aprovar produtores, cancelar pedidos problemáticos, gerar relatórios.

---

## Etapa 6 — Melhorias e App do Entregador

**Objetivo:** Adicionar features que fazem a plataforma "completa" e introduzir o 4º app.

**Escopo:**

### Avaliações:

- [ ] Cliente avalia pedido após "entregue" (1-5 estrelas + comentário)
- [ ] Avaliação aparece no perfil público do produtor
- [ ] Produtor pode responder avaliação
- [ ] Admin pode moderar avaliações ofensivas

### Cupons (expansão):

- [ ] Cupons por produtor (não só globais)
- [ ] Cupons de primeira compra
- [ ] Cashback básico

### Notificações Push (FCM em todos os apps):

- [ ] Consumidor: status do pedido, promoções
- [ ] Produtor: novo pedido (mesmo sem aba aberta)
- [ ] Entregador: nova entrega disponível
- [ ] Admin: alertas críticos (pedido cancelado, problema de pagamento)

### App Entregador (novo app `apps/entregador`):

- [ ] Criar app Next.js (PWA agressivo, mobile-first)
- [ ] Cadastro e aprovação de entregador
- [ ] Lista de entregas disponíveis (filtrada por distância)
- [ ] Aceitar/recusar entrega
- [ ] Mudança de status: a caminho do produtor → coletei → entregue
- [ ] GPS em foreground (quando app está aberto — PWA não tem background GPS confiável)
- [ ] Histórico de entregas
- [ ] Painel de ganhos (corridas + gorjetas)

### Cloud Functions:

- [ ] `findAvailableDriver` — algoritmo simples (mais próximo + ativo)
- [ ] `onDeliveryAccepted` — atualiza pedido, notifica cliente
- [ ] `processPayout` — agrega ganhos por entregador

### Outros:

- [ ] Sistema de favoritos (cliente favorita produtores)
- [ ] Histórico de busca
- [ ] Recomendações básicas ("você pode gostar")

**Critério de conclusão:** Plataforma com fluxo end-to-end completo: cliente pede → produtor prepara → entregador retira → cliente recebe → todos avaliam.

---

## Etapa 7+ (Backlog Futuro)

Não fazem parte do MVP mas precisam estar listadas:

- Integração Focus NFe (emissão fiscal real)
- App entregador nativo (React Native) com GPS em background
- Multi-horta por produtor (rede de lojas)
- Programa de fidelidade
- Chat in-app cliente ↔ produtor / cliente ↔ entregador
- Pagamento na entrega (dinheiro/máquina)
- Agendamento de pedidos (pedir para um horário futuro)
- Internacionalização (mais idiomas)
- Recomendações com ML
- A/B testing
- Observabilidade (Sentry, analytics)

---

## Como o Claude Code deve se comportar entre etapas

1. **Não pular etapas.** Se a Etapa 2 não está completa, não começar Etapa 3.
2. **Não criar features fora do escopo da etapa atual.** Se aparecer algo que seria útil, anotar como "FUTURO" em comentário ou abrir issue.
3. **Não deixar débito técnico acumular.** Se um TODO ficou na Etapa 2, listar em "Pendências" no fim da Etapa 2 antes de seguir.
4. **Atualizar `CLAUDE.md` → Status Atual** ao concluir cada etapa.
5. **Tag de versão no Git ao concluir etapa:** `git tag etapa-1`, `etapa-2`, etc.

