# UI & UX — Design System Compartilhado

Princípios de design, design tokens e padrões visuais válidos para os 4 apps.

## Filosofia

- **Moderno, minimalista, profissional.** Não competir em "design diferente" — competir em ser **claro e rápido**.
- **Inspiração:** iFood é a referência de UX para delivery no Brasil. Não copiar visualmente, mas seguir os padrões que o usuário **já espera**.
- **Mobile-first** no consumidor, produtor (em tablet/celular) e entregador. **Desktop-first** no backoffice.
- **Feedback constante.** Toast, skeleton, loading, sucesso visível. Nunca deixar o usuário com dúvida do que aconteceu.
- **Acessibilidade não é opcional.** WCAG 2.1 AA mínimo.

## Identidade Visual — Ambiente Livre

> **Fonte de verdade:** `assets/branding/Logo_Separado.png` e `assets/branding/Manual de Marca_Ambiente Livre.pdf`

### Marca

**Nome:** Ambiente Livre  
**Símbolo:** Árvore com folhas circulares sustentada por duas mãos — representa natureza, cuidado e comunidade.  
**Arquivo da logo:** `assets/branding/Logo_Separado.png` → copiada para `public/logo.png` em cada app.  
**Favicon:** SVG gerado em `src/app/icon.svg` em cada app (detecção automática pelo Next.js App Router).

### Paleta oficial extraída do logotipo

Todos os 3 apps usam **a mesma escala de tokens** — a diferença visual vem de *como* os tokens são aplicados em cada contexto (sidebar bg, botões, ícones), não dos valores hexadecimais em si.

| Token | Hex | Uso |
|-------|-----|-----|
| `brand-50`  | `#EEF8F4` | Background de estados hover leve |
| `brand-100` | `#CCE8DF` | Badge, pill, chip |
| `brand-200` | `#9CCFC0` | Borda em foco |
| `brand-300` | `#6BBBA9` | Texto em sidebar escura (produtor/backoffice) |
| `brand-400` | `#4FA593` | Ícones ativos em sidebar escura |
| `brand-500` | `#4A9080` | **Cor primária** — botões, links, foco (círculos do logotipo) |
| `brand-600` | `#3A7267` | Hover de botões primários |
| `brand-700` | `#2B5649` | Active, pressed — galhos do logotipo |
| `brand-800` | `#1C3C2E` | Background da sidebar do produtor |
| `brand-900` | `#112520` | Background da sidebar do backoffice — mãos do logotipo |
| `brand-950` | `#08130F` | Ultra-escuro (bordas internas de sidebar) |

### Diferenciação por app (uso dos tokens)

| App | Sidebar bg | Primary CTA | Active nav |
|-----|-----------|-------------|------------|
| Consumidor | branco (`bg-white`) | `brand-500` | `brand-500`/`brand-50` |
| Produtor | `brand-800` | `brand-500` | `brand-900/60` + texto branco |
| Backoffice | `brand-900` | `brand-500` | `brand-800` + texto branco |

### Arquivo de tokens TypeScript

```typescript
// packages/shared-ui/src/tokens/colors.ts
import { brand, semantic, orderStatus } from '@marketplace/shared-ui'
```

### Tokens semânticos (iguais nos 4 apps)

```typescript
// packages/shared-ui/src/tokens/colors.ts
export const colors = {
  // Semânticas
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutros (Tailwind slate)
  neutral: {
    50:  '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Status de pedido (compartilhado entre consumidor e produtor)
  orderStatus: {
    pending:    '#F59E0B',
    confirmed:  '#3B82F6',
    preparing:  '#8B5CF6',
    ready:      '#06B6D4',
    onDelivery: '#10B981',
    delivered:  '#22C55E',
    cancelled:  '#EF4444',
  },
}
```

Cada app define sua `brand` em `tailwind.config.ts` e estende:

```typescript
// apps/consumidor/tailwind.config.ts
import sharedConfig from '@marketplace/shared-config/tailwind/base'

export default {
  presets: [sharedConfig],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#FEE2E5',
          500: '#EA1D2C',
          600: '#C81222',
          // ...
        },
      },
    },
  },
}
```

### Tipografia

**Fonte:** Inter (Google Fonts) — moderna, legível em qualquer tamanho, suporte completo a PT-BR.

```typescript
import { Inter } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})
```

Hierarquia (Tailwind):

| Uso | Tamanho mobile | Tamanho desktop |
|-----|----------------|------------------|
| Display | `text-3xl` (30px) | `text-5xl` (48px) |
| H1 | `text-2xl` (24px) | `text-4xl` (36px) |
| H2 | `text-xl` (20px) | `text-3xl` (30px) |
| H3 | `text-lg` (18px) | `text-xl` (20px) |
| Body | `text-base` (16px) | `text-base` (16px) |
| Small | `text-sm` (14px) | `text-sm` (14px) |
| Tiny | `text-xs` (12px) | `text-xs` (12px) |

**Nunca usar fonte abaixo de 14px em texto contínuo.**

### Espaçamento

Sistema de 4px (padrão Tailwind). Usar **múltiplos de 4** sempre que possível:

- `p-1` (4px), `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px), `p-8` (32px)

### Bordas e raios

- `rounded` (4px) — inputs pequenos
- `rounded-lg` (8px) — botões, cards pequenos
- `rounded-xl` (12px) — cards
- `rounded-2xl` (16px) — modais
- `rounded-full` — avatars, badges circulares

### Sombras

```typescript
shadow-sm    // sutil, para inputs em foco
shadow       // padrão para cards
shadow-md    // cards elevados
shadow-lg    // modais, dropdowns
shadow-xl    // diálogos críticos
```

## Componentes do Design System

Em `packages/shared-ui/src/components/`. Todos são funcionais, com TypeScript estrito.

### Primitivos

- **`Button`** — variants: `primary`, `secondary`, `ghost`, `destructive`, `link`. Tamanhos: `sm`, `md`, `lg`. Estado: `loading`, `disabled`.
- **`IconButton`** — botão só com ícone, com tooltip
- **`Input`** — text input com label, error, helper text, prefix/suffix
- **`Textarea`**
- **`Select`** — usar Radix UI ou Headless UI como base
- **`Combobox`** — para busca com autocomplete
- **`Checkbox`**
- **`Radio`**
- **`Switch`** — para toggles
- **`Slider`**

### Layout

- **`Card`** — container padrão com sombra
- **`Divider`**
- **`Container`** — wrapper com max-width responsivo
- **`Stack`** — flex column com gap
- **`Cluster`** — flex row com gap e wrap

### Feedback

- **`Skeleton`** — placeholder de loading
- **`Toast`** — notificação canto da tela (lib: Sonner ou react-hot-toast)
- **`Modal`** / **`Dialog`** — Radix UI
- **`Drawer`** — lateral (carrinho, menu mobile)
- **`Spinner`** — só para esperas curtas; preferir skeleton
- **`EmptyState`** — quando lista vazia
- **`ErrorBoundary`**

### Display

- **`Avatar`** — com fallback de iniciais
- **`Badge`** — para tags, status
- **`StatusBadge`** — variante específica para status de pedido
- **`Tag`** — removível
- **`Tooltip`**
- **`Popover`**

### Forms

- **`FormField`** — wrapper com label + input + error
- **`FormSection`** — agrupador
- **`SubmitButton`** — Button que respeita `formState.isSubmitting`

### Específicos do domínio

- **`PriceTag`** — formata valor em centavos para "R$ XX,XX"
- **`OrderStatusBadge`** — badge específico para status de pedido
- **`ProdutorCard`** — card de produtor (usado no consumidor)
- **`ProductCard`** — card de produto
- **`OrderCard`** — card de pedido (usado no produtor e admin)
- **`OrderTimeline`** — linha do tempo do pedido (usado no consumidor)

## Responsividade

Breakpoints (Tailwind padrão):

| Breakpoint | Largura | Uso |
|------------|---------|-----|
| (default) | < 640px | Mobile |
| `sm:` | ≥ 640px | Mobile grande / tablet pequeno |
| `md:` | ≥ 768px | Tablet |
| `lg:` | ≥ 1024px | Desktop |
| `xl:` | ≥ 1280px | Desktop grande |
| `2xl:` | ≥ 1536px | Desktop XL |

### Estratégia por app

- **Consumidor:** projetar primeiro para mobile (< 640px). Tablet/desktop são adaptações.
- **Produtor:** projetar primeiro para tablet (~ 768-1024px). Mobile e desktop são casos secundários.
- **Backoffice:** projetar primeiro para desktop (≥ 1024px). Mobile mostra versão limitada (só leitura, por exemplo).
- **Entregador:** mobile-only. Bloquear em desktop com mensagem "Use o celular".

### Touch targets

Mínimo de **44x44px** para qualquer alvo de toque (botões, ícones clicáveis). Especialmente crítico no produtor (operador com mãos sujas/molhadas) e entregador (em movimento).

## Loading e estados

### Padrão para listas

```
1. Loading inicial → Skeleton (não spinner)
2. Sucesso → conteúdo
3. Vazio → EmptyState com CTA
4. Erro → ErrorState com botão "Tentar novamente"
```

### Padrão para ações

```
1. Idle → Button habilitado
2. Submitting → Button com Spinner + "Salvando..."
3. Sucesso → Toast verde + atualização visual
4. Erro → Toast vermelho + manter form preenchido
```

### Padrão para real-time

- `onSnapshot` com fallback gracioso se conexão cai
- Banner persistente "Sem conexão" quando offline
- Indicador de "última atualização há Xs" em telas críticas

## Animações

- Usar **Framer Motion** para animações complexas (página inteira, drawer)
- Tailwind `transition-*` para hover/focus simples
- **Respeitar `prefers-reduced-motion`**:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Dark mode

**Por enquanto não implementar.** Adicionar como melhoria futura (Etapa 7+) via:

- Classe `dark:` do Tailwind
- Toggle no perfil do usuário
- Preferência do sistema como default (`prefers-color-scheme`)

Decisão: o overhead de manter ambos os modos não justifica no MVP. Quando implementar, fazer em todos os 4 apps de uma vez para manter consistência.

## SEO (consumidor apenas)

- Meta tags dinâmicas via `generateMetadata` do App Router
- Open Graph completo (`og:title`, `og:image`, `og:description`)
- Twitter Cards
- Schema.org JSON-LD para `Produtor`, `Menu`, `MenuItem`
- Sitemap automático em `app/sitemap.ts`
- `robots.txt` permitindo só rotas públicas

## Performance — métricas-alvo

| Métrica | Consumidor | Outros apps |
|---------|------------|-------------|
| LCP (Largest Contentful Paint) | < 2.5s | < 3.5s |
| FID (First Input Delay) | < 100ms | < 200ms |
| CLS (Cumulative Layout Shift) | < 0.1 | < 0.2 |
| Tempo até interativo (4G) | < 3s | < 5s |
| Bundle JS inicial | < 200KB | < 400KB |

Como atingir:
- `next/image` para tudo
- Code splitting natural do App Router
- Lazy load de componentes pesados (`dynamic(() => import(...))`)
- Pré-fetch de rotas prováveis (`<Link prefetch>`)
- Cache HTTP agressivo em assets estáticos
- Tree shaking de Recharts/Tremor (importar só o que usa)

## Acessibilidade

### Mínimos obrigatórios

- Lighthouse a11y ≥ 95 em todas as páginas
- Contraste WCAG AA (4.5:1 para texto normal, 3:1 para texto grande)
- Todos os botões e links são focáveis com Tab
- Outline visível no foco (não remover sem substituir)
- `alt` em todas as imagens (ou `alt=""` para decorativas)
- `aria-label` em ícones clicáveis sem texto
- Labels associados a inputs (`<label for>` ou `aria-labelledby`)
- Erros de formulário anunciados via `aria-live`

### Navegação por teclado

- Tab/Shift+Tab para navegar
- Enter/Espaço para ativar
- Escape para fechar modais/drawers
- Setas para navegar em listas (Combobox, Menu)
- Focus trap em modais

## Internacionalização (futuro)

Mesmo só PT-BR agora, **estruturar para i18n desde o início**:

- Usar `next-intl` ou `next-i18next`
- Strings em arquivos JSON por idioma
- Datas via `date-fns` com locale
- Moeda formatada via `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

## Tom de voz (microtexto)

- **Direto e cordial.** "Adicionar ao carrinho" — não "Quero adicionar este item ao meu carrinho"
- **Pessoal.** "Seu pedido" — não "O pedido do usuário"
- **Sem jargão.** "Conta criada!" — não "Cadastro efetuado com sucesso"
- **Erros sem culpar.** "Não conseguimos processar seu pagamento. Tente novamente." — não "Você fez algo errado"
- **Confirmações positivas.** "Pedido confirmado!" + ícone — não só "OK"

## Checklist de UI por nova tela

Antes de mergear:

- [ ] Funciona em mobile (320px de largura mínima)?
- [ ] Funciona em desktop (1920px)?
- [ ] Loading state implementado (skeleton)?
- [ ] Empty state implementado?
- [ ] Error state implementado?
- [ ] Acessível por teclado?
- [ ] Lighthouse a11y ≥ 95?
- [ ] Contraste WCAG AA?
- [ ] Imagens otimizadas (`next/image`)?
- [ ] Meta tags (se for pública e indexável)?


