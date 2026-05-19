# App Backoffice

Painel administrativo da plataforma — usado pela **equipe interna** que gerencia a operação como um todo.

## Características-chave

- **Desktop-first.** Telas densas, tabelas grandes, múltiplos painéis. Tablet funciona, celular tem versão reduzida.
- **Dados densos.** Listagens com paginação, filtros complexos, exportação.
- **Segurança máxima.** É o ponto mais sensível — controle total da plataforma.
- **Auditoria.** Toda ação admin importante é logada em `auditLogs/`.
- **Acesso restrito.** Apenas usuários com `role: 'admin'` (e idealmente com 2FA).

## Stack específica deste app

- Next.js 15 — pode usar SSR para páginas pesadas de dados
- **Tanstack Table** para tabelas avançadas (sort, filter, pagination server-side)
- **Recharts** ou **Tremor** para gráficos
- **React Hook Form + Zod** para formulários
- React Query para queries não-realtime (vai economizar muita leitura do Firestore)

## Princípio de segurança crítico

> **NUNCA confiar no client.** Toda operação destrutiva ou que mude permissões deve passar por uma Cloud Function que valida `request.auth.token.role === 'admin'`. As regras do Firestore garantem isso também — defesa em camadas.

Operações admin via UI são "fachada" — quem realmente faz é a Cloud Function.

## Fluxos Principais

### Fluxo 1: Aprovação de produtor

1. Produtor cadastra → status `pending`, claim `approved: false`
2. Admin entra em `/produtores/pendentes`
3. Lista de pendências com filtros (data, cidade)
4. Admin abre detalhes: vê documentos, dados, endereço
5. Clica "Aprovar" → modal de confirmação
6. **Cloud Function `approveProdutor`:**
   - Valida que quem chama é admin
   - Seta `approved: true` no documento
   - Seta custom claim `approved: true` no Auth do produtor
   - Cria log em `auditLogs/`
   - Envia email para o produtor
7. Produtor aparece na home do consumidor

### Fluxo 2: Cancelar pedido problemático (intervenção)

1. Cliente reclama → admin abre o pedido
2. Vê histórico completo + tentativas de contato
3. Clica "Cancelar pedido"
4. Modal: motivo obrigatório + opção "Estornar valor"
5. **Cloud Function `adminCancelOrder`:**
   - Valida admin
   - Muda status para `cancelled_by_admin`
   - Se "estornar": chama Mercado Pago API de refund
   - Notifica produtor (FCM)
   - Notifica cliente (FCM + email)
   - Cria log em `auditLogs/`

### Fluxo 3: Gestão de comissões

1. `/financeiro/comissoes`
2. Lista de produtores com:
   - Taxa atual (% sobre pedido)
   - Faturamento mês corrente
   - Comissão devida
3. Admin pode ajustar taxa por produtor (com data de vigência)
4. Mudanças não afetam pedidos passados

## Telas / Rotas

```
/                              Dashboard (visão geral)
/relatorios                    Relatórios e exportações

/usuarios                      Lista de usuários
/usuarios/[uid]                Detalhes do usuário

/produtores                  Lista de produtores (todos)
/produtores/pendentes        Pendentes de aprovação
/produtores/[id]             Detalhes / edição

/pedidos                       Todos os pedidos
/pedidos/[id]                  Detalhes + ações admin

/financeiro
/financeiro/comissoes          Gestão de comissões
/financeiro/repasses           Repasses pendentes
/financeiro/estornos           Histórico de estornos

/cupons                        CRUD de cupons globais
/cupons/[id]                   Detalhes / edição

/entregadores                  Lista (Etapa 6)
/entregadores/pendentes        Pendentes de aprovação

/configuracoes
/configuracoes/taxas           Taxa padrão da plataforma
/configuracoes/regioes         Áreas de atendimento
/configuracoes/categorias      Categorias de produtor (Pizza, Hambúrguer...)

/auditoria                     Log de ações admin

/perfil                        Perfil do admin (trocar senha, 2FA)
```

## Componentes-chave (deste app)

- `AdminLayout` — sidebar fixa + topbar com perfil/notificações
- `DataTable` — tabela paginada server-side (genérica, reutilizável)
- `FilterBar` — barra de filtros complexos
- `StatCard` — KPI card para dashboard
- `LineChart`, `BarChart`, `PieChart` — wrappers de Recharts
- `DateRangePicker` — seletor de período (hoje/semana/mês/customizado)
- `AuditLogViewer` — visualização de logs com diff
- `ConfirmDestructiveAction` — modal de confirmação para ações sensíveis
- `ExportButton` — exporta tabela atual em CSV/XLSX

## Dashboard — KPIs

Cards na primeira dobra:

- **Pedidos do dia** (contagem + variação % vs ontem)
- **GMV do dia** (volume bruto de mercadoria — total de pedidos)
- **Receita da plataforma** (soma das comissões)
- **Novos cadastros (clientes + produtores))
- **Pedidos em andamento** (não-entregues ainda)
- **Produtores ativos** (com pedido nas últimas 24h)

Gráficos:

- Linha: pedidos por dia (últimos 30 dias)
- Linha: GMV por dia
- Barra: top 10 produtores (faturamento mês)
- Pizza: pedidos por categoria
- Mapa de calor: pedidos por região (futuro)

## Exportação

Botão "Exportar" em toda lista grande:
- CSV (padrão)
- XLSX (com formatação)
- PDF (somente relatórios, não listas)

Bibliotecas: `papaparse` (CSV), `xlsx` (Excel), `react-pdf` (PDF).

## Auditoria

Toda ação admin que muda estado importante grava em `auditLogs/`:

```typescript
interface AuditLog {
  id: string
  adminUid: string
  adminEmail: string
  action: 'produtor.approve' | 'produtor.suspend' | 'order.cancel' | ...
  targetType: 'produtor' | 'order' | 'user' | ...
  targetId: string
  before: Record<string, any>  // estado antes
  after: Record<string, any>   // estado depois
  reason?: string              // motivo (quando aplicável)
  timestamp: Timestamp
  ip: string                   // capturado na Cloud Function
}
```

A tela `/auditoria` permite filtrar por admin, ação, alvo, data.

## Acesso e 2FA

- Login só por email/senha (sem Google, sem signup)
- Admin é criado **manualmente** via Firebase Console pela primeira vez
- Admins criam outros admins via tela própria (com aprovação dupla, se possível)
- **2FA via TOTP** preparado desde o início (mesmo que ative depois)
- **Sessão curta** (4h) com renovação automática
- Considerar **IP whitelist** via Netlify Edge Functions em produção

## Métricas que importam

- Tempo médio para aprovar produtor (KPI interno)
- Taxa de cancelamento por motivo
- NPS (futuro)
- Tickets de suporte em aberto (futuro, quando tiver chat)


