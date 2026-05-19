# Arquitetura

Este documento explica as **decisões arquiteturais** do projeto. Antes de propor mudanças estruturais, leia este documento.

## Visão Geral

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ CONSUMIDOR  │  │  PRODUTOR   │  │ BACKOFFICE  │  │ ENTREGADOR  │
│  (mobile)   │  │ (PWA/desk)  │  │  (desktop)  │  │  (mobile)   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │                │
       └────────────────┴────────────────┴────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │      FIREBASE (único)         │
                │  Auth + Firestore + Storage   │
                │      Cloud Functions          │
                └───────────────┬───────────────┘
                                │
                  ┌─────────────┴─────────────┐
                  │      Mercado Pago         │
                  │   (webhook via Functions) │
                  └───────────────────────────┘
```

## Por que 4 apps separados (e não um único multi-tenant)

**Públicos com necessidades opostas:**

| App | Necessidade dominante |
|-----|----------------------|
| Consumidor | Leveza, abertura rápida, SEO, descoberta de produtos |
| Produtor | Sempre aberto, áudio agressivo, impressão, gestão |
| Backoffice | Desktop, tabelas densas, gráficos, filtros complexos |
| Entregador | GPS, baixo consumo de bateria, notificação push |

Se fosse um app só:
- O consumidor baixaria o código do dashboard (bundle ~3x maior)
- Mudanças no produtor poderiam quebrar o checkout
- SEO ficaria comprometido por código atrás de auth
- Não dá para colocar IP whitelist no backoffice sem afetar os outros

**Separados:**
- Cada bundle só carrega o que aquele público usa
- Deploy independente — bug no admin não derruba a venda
- Domínios/subdomínios independentes
- Possibilidade futura de IP whitelist, MFA obrigatório, etc. apenas onde faz sentido

## Por que monorepo (e não 4 repositórios)

Apps separados ≠ código separado. Sem monorepo, surgem problemas graves:

- **Duplicação de tipos.** `interface Pedido` definida 4 vezes; cada hora um campo divergente.
- **Lógica de negócio inconsistente.** `calcularTaxaEntrega` ligeiramente diferente em cada app.
- **Design system fragmentado.** Botão "primário" com cores ligeiramente diferentes em cada lugar.
- **Sincronização manual de schema.** Mudou um campo? Boa sorte abrindo 4 PRs e lembrando de tudo.
- **Versionamento de mudanças cross-app.** Como garantir que `consumidor` e `produtor` viram a mesma versão de uma nova feature de pedidos?

Com monorepo (Turborepo + pnpm):
- **Um único deploy de tipos compartilhados** beneficia os 4 apps automaticamente
- Cache de build inteligente — só rebuilda o que mudou
- PRs únicos atravessam múltiplos apps coerentemente
- Design system, regras, scripts ficam centralizados

## Por que Turborepo + pnpm (e não outras opções)

| Ferramenta | Por que escolhi (ou não) |
|------------|--------------------------|
| **Turborepo** ✅ | Padrão atual da indústria (Vercel), cache local + remoto, integração nativa com Next.js, configuração simples |
| Nx | Mais robusto, mas curva de aprendizado maior. Overkill para 4 apps |
| Lerna | Legado, manutenção mínima desde 2022 |
| Bun workspaces | Promissor mas ainda novo para produção crítica |
| **pnpm** ✅ | 2-3x mais rápido que npm, usa hard links (economiza disco), workspaces nativos, evita "phantom dependencies" |
| npm workspaces | Funciona, mas mais lento e menos rigoroso com dependências |
| Yarn classic / berry | Yarn berry tem PnP que conflita com várias libs; classic está obsoleto |

## Por que Firebase (e não Supabase, Pocketbase, backend próprio)

| Critério | Firebase | Alternativas |
|----------|----------|--------------|
| Realtime nativo | ✅ `onSnapshot` em qualquer documento | Supabase tem, Pocketbase tem |
| Auth pronto | ✅ Email, Google, OTP, anônimo, custom claims | Supabase ✅, próprio = trabalho |
| Storage | ✅ Integrado | Supabase ✅, S3 = config |
| Functions serverless | ✅ Triggers em qualquer evento Firestore/Auth | Supabase Edge Functions |
| Custo inicial | Generoso plano gratuito | Supabase ✅ |
| Vendor lock-in | ⚠️ Alto (NoSQL proprietário) | Supabase é Postgres puro = menos lock-in |

Para esse projeto, o ganho de **realtime + auth + storage + functions tudo integrado** supera o lock-in inicial. Migrar para Supabase no futuro é doloroso mas viável (Firestore exporta JSON, Postgres importa).

## Por que Next.js para os 3 apps

Embora apenas o `consumidor` precise de SEO real, padronizar em Next.js para os 3 reduz a curva de aprendizado e permite compartilhar mais código. Os apps internos (produtor, backoffice) podem ser configurados como **client-side rendered** desabilitando SSR onde não faz sentido — efetivamente viram SPAs servidas pela mesma stack.

Alternativa válida seria Vite + React puro para produtor/backoffice (bundle menor, dev server mais rápido), mas:
- Adiciona uma stack a mais para manter
- Roteamento divergente entre apps
- Configuração de deploy diferente na Netlify

Decisão: **Next.js em todos**, com SSR opcional por app.

## Sincronização entre apps

Os 4 apps são **completamente independentes em deploy** mas **fortemente acoplados em dados**. A sincronização acontece via Firestore:

1. **Cliente faz pedido** no app `consumidor` → grava em `orders/`
2. **Cloud Function trigger** `onCreate` em `orders/` → envia push para o produtor
3. **App `produtor`** está com `onSnapshot` ativo em `orders/` filtrado por `produtorId` → recebe o pedido em ~100ms, toca som de alerta
4. Produtor muda status → atualiza documento → cliente vê mudança em tempo real no `consumidor`
5. Status "saiu para entrega" → trigger notifica entregadores próximos
6. Backoffice tem dashboard com agregações atualizadas via outra Cloud Function

**Nenhum app "chama" outro app.** Todos se comunicam **através do Firestore como fonte única da verdade.**

## Custom Claims — controle de acesso

O Firebase Auth permite anexar dados arbitrários ao token JWT do usuário (custom claims). Usamos isso para roles:

```typescript
// Setado via Cloud Function (admin SDK), nunca no client
{
  role: 'cliente' | 'produtor' | 'admin' | 'entregador',
  produtorId?: string,  // só para produtor (qual horta ele gerencia)
  approved: boolean       // produtores e entregadores precisam ser aprovados pelo admin
}
```

As regras do Firestore conferem essa claim para autorizar operações. Sem claim, o usuário é tratado como `cliente` por padrão (qualquer um pode se cadastrar como cliente).

Detalhes completos em `docs/seguranca.md`.

## Estratégia de roteamento (subdomínios vs paths)

**A decisão foi adiada.** Quando chegar a hora do deploy de produção (Etapa 1 / fim da Etapa 5), avaliar:

- **Subdomínios** (`app.seusite.com`, `parceiro.seusite.com`, `admin.seusite.com`):
  - ✅ Cookies isolados (mais seguro contra XSS cross-app)
  - ✅ CSPs e headers independentes
  - ✅ Cada app na Netlify aponta para seu subdomínio sem complicação
  - ⚠️ Cliente vê URLs diferentes (pode ser desejável ou não)
- **Paths** (`seusite.com/`, `seusite.com/parceiro`, `seusite.com/admin`):
  - ✅ Visualmente unificado
  - ⚠️ Precisa de proxy/redirect na Netlify (`_redirects` ou Edge Functions)
  - ⚠️ Cookies compartilhados (cuidado com CSRF)

Para já, o **desenvolvimento local** roda em portas separadas (3000-3003). Em produção é só apontar cada Netlify site para o subdomínio quando decidir.

## Estratégia PWA

Os 4 apps são **PWAs** (Progressive Web Apps) usando `next-pwa`. Isso permite:

- Instalação na home screen (parece app nativo)
- Funcionamento offline básico (cache de assets)
- Push notifications (importante para produtor e entregador)
- Sem precisar publicar em App Store / Play Store

**No futuro**, o app do entregador pode virar React Native nativo (Etapa 7+) para ter GPS em background — limitação do PWA. Para a Etapa 6, PWA é suficiente.

## Camadas e dependências

**Regra:** apps podem importar packages, packages podem importar outros packages, mas **nunca o contrário**. Packages **nunca** importam de apps.

Hierarquia de dependências entre packages:

```
shared-utils      (sem dependências internas)
   ↑
shared-types      (depende só de utils, se precisar)
   ↑
shared-firebase   (depende de types)
   ↑
shared-services   (depende de firebase + types + utils)
   ↑
shared-ui         (depende de types, sem firebase)
   ↑
apps/*            (podem importar qualquer package)
```

Quebrar isso causa dependências circulares — o Turborepo vai reclamar.

## Pontos de atenção que vão aparecer no futuro

Listo aqui antecipadamente para serem considerados nas decisões:

1. **Notificações push:** Firebase Cloud Messaging (FCM) é o caminho. Cada app registra seu próprio token.
2. **Geolocalização e cálculo de distância:** GeoFirestore ou Cloud Functions com cálculo de haversine.
3. **Multi-horta por produtor:** o campo `produtorId` na claim pode virar `produtorIds: string[]` se um operador gerencia várias lojas.
4. **Internacionalização:** mesmo só PT-BR agora, usar `next-intl` desde o início economiza dor depois.
5. **Observabilidade:** Sentry para erros, Plausible/Umami para analytics privacy-first.
6. **Filas:** se webhooks do Mercado Pago começarem a falhar, Cloud Tasks para retry.

Quando for a hora de cada um, atualize a etapa correspondente em `docs/etapas.md`.


