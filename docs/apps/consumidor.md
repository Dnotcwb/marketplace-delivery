# App Consumidor

Aplicação destinada ao **cliente final** que faz pedidos.

## Características-chave

- **Mobile-first absoluto.** ~80% dos usuários abrirão no celular.
- **Bundle enxuto.** Cada KB conta — usuário pode estar em 4G ruim.
- **SEO importante.** páginas de produtores precisam ser indexáveis pelo Google.
- **PWA.** Instalável na home screen, funciona offline para navegação básica.
- **Tempo de carregamento < 2s** no 4G (meta).

## Stack específica deste app

- Next.js 15 App Router com **SSG/ISR** onde possível (páginas de produtor, categorias)
- `next/image` com lazy loading agressivo
- `next-pwa` configurado
- `next-intl` (preparado para i18n futura, mesmo só PT-BR agora)
- Skeleton screens (não spinners) durante loading
- React Query (`@tanstack/react-query`) para cache de dados não-realtime

## Fluxos Principais

### Fluxo 1: Onboarding (primeira visita)

1. Usuário acessa o site
2. Pede permissão de geolocalização (com fallback de digitar CEP)
3. Mostra produtores próximos ordenados por distância
4. Usuário navega sem precisar logar

**Decisão:** **navegação sem login é obrigatória.** Só pedir login no momento do checkout.

### Fluxo 2: Pedido completo

1. Usuário escolhe produtor na home
2. Navega no cardápio (Server Component, SSG)
3. Clica em produto → modal com adicionais (Client Component)
4. Adiciona ao carrinho (persiste em localStorage se não logado)
5. Clica em "Ver carrinho" → drawer/página de carrinho
6. Confirma e vai para checkout
7. **Aqui pede login (se não estiver logado)** — Google ou email
8. Seleciona endereço de entrega (CRUD se primeiro endereço)
9. Aplica cupom (opcional)
10. Escolhe pagamento: PIX (default) ou cartão
11. Confirma pedido
12. **PIX:** mostra QR code, app fica em polling do status
13. **Cartão:** processa via Brick do Mercado Pago, retorna sucesso/falha
14. Pedido confirmado → tela de acompanhamento (real-time)

### Fluxo 3: Acompanhamento

- Tela com timeline visual:
  - ⚫ Confirmado ✅
  - ⚫ Em preparo ✅
  - ⚪ Saiu para entrega
  - ⚪ Entregue
- Tempo estimado (atualizado pelo produtor)
- Botão "Cancelar pedido" (só disponível enquanto está `pending`)
- Dados do entregador (quando atribuído — Etapa 6)
- Avaliar após `delivered` (Etapa 6)

## Telas / Rotas

```
/                              Home — lista de produtores próximos
/produtor/[slug]            Catálogo do produtor (SSG/ISR)
/produtor/[slug]/[productId] Modal de produto (intercepting route)
/busca                         Resultados de busca
/categorias                    Listagem por categoria
/categoria/[slug]              Produtores de uma categoria

/login                         Login (email/senha + Google)
/cadastro                      Cadastro (apenas cliente)
/recuperar-senha               Recuperação

/carrinho                      Carrinho cheio (página)
/checkout                      Checkout completo
/checkout/sucesso/[orderId]    Sucesso pós-pagamento
/checkout/pagamento/[orderId]  Aguardando pagamento (PIX)

/pedidos                       Histórico
/pedido/[orderId]              Detalhes + acompanhamento real-time

/perfil                        Dados pessoais
/perfil/enderecos              CRUD de endereços
/perfil/pagamentos             Métodos salvos (futuro)

/favoritos                     Produtores favoritados (Etapa 6)
```

## Componentes-chave (que ficam neste app, não em shared-ui)

- `ProdutorList` — lista responsiva de produtores com filtros
- `ProductCard` — card de produto no cardápio
- `ProductModal` — modal com detalhes + adicionais
- `CartDrawer` — drawer lateral do carrinho
- `CheckoutSteps` — wizard de checkout
- `OrderTracker` — timeline visual do pedido
- `AddressPicker` — seletor + cadastro de endereço com geocoding
- `CouponInput` — input de cupom com validação

## Componentes que vêm de `shared-ui`

- `Button`, `Input`, `Select`, `Card` (primitivos)
- `Modal`, `Drawer`, `Toast`
- `Skeleton` (loading)
- `StatusBadge` (também usado no produtor)

## Estado global (Contexts)

- `AuthContext` (de `shared-services`) — usuário logado
- `CartContext` (de `shared-services`) — carrinho
- `LocationContext` (deste app) — localização atual do usuário
- `ToastContext` (de `shared-services` ou `shared-ui`) — notificações

## Performance

- Imagens em formato `webp` ou `avif` via `next/image`
- Code splitting automático do App Router
- Pré-carregar próxima rota provável (`<Link prefetch>`)
- Cache de queries não-realtime via React Query
- Não usar `onSnapshot` para listagens estáticas (custa muito Firestore reads)

## SEO

- Cada produtor tem URL única (`/produtor/[slug]`)
- Meta tags dinâmicas (`generateMetadata` do App Router)
- Schema.org `Produtor`, `Menu`, `MenuItem` (JSON-LD)
- Sitemap dinâmico via `app/sitemap.ts`
- `robots.txt` permitindo crawling apenas das rotas públicas

## Acessibilidade

- Lighthouse a11y ≥ 95
- Navegação por teclado funcional
- Contraste WCAG AA
- Alt em todas as imagens
- ARIA labels onde necessário


