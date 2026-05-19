# App Produtor

Aplicação destinada aos **produtores / agricultores** para gerenciar cardápio, pedidos e operação.

## Características-chave

- **Sempre aberto.** É a ferramenta de trabalho — fica numa tablet ou PC do balcão o dia inteiro.
- **Alertas agressivos.** Som alto + visual quando chega pedido. Sem isso, o produtor perde venda.
- **Tempo real obrigatório.** Latência < 1s do pedido novo aparecer na tela.
- **Impressão de comanda.** Suporte a impressoras térmicas (via `window.print()` + CSS @print).
- **Resistente a quedas de conexão.** Reconectar automaticamente, ressincronizar.
- **Tablet-first.** Mas funciona em desktop (balcão) e celular (gestor móvel).

## Stack específica deste app

- Next.js 15 com **client-side rendering predominante** (não precisa de SEO)
- `next-pwa` configurado para PWA agressivo (instalável, offline-first)
- **Sem React Query** — usar `onSnapshot` direto para tudo (é tudo real-time)
- Web Audio API + HTMLAudioElement para som de alerta
- Service Worker customizado para receber FCM em background

## Fluxos Principais

### Fluxo 1: Onboarding do produtor

1. Acesso a `/cadastro`
2. Preenche dados pessoais + dados do produtor
3. Upload de documentos (CNPJ, alvará)
4. Status fica `pending` → aguarda aprovação do admin
5. Recebe email quando aprovado
6. Faz login → home com mensagem de boas-vindas + tutorial

### Fluxo 2: Recebimento e processamento de pedido (CRÍTICO)

**Este é o fluxo mais importante do app. Latência e confiabilidade são tudo.**

1. Produtor está com o app aberto, tela "Pedidos" como home
2. Cliente faz pedido → Cloud Function processa → grava em `orders/{id}`
3. App produtor tem `onSnapshot` ativo em `orders` filtrado por `produtorId == meuProdutor && status == 'confirmed'`
4. Pedido aparece **instantaneamente** no card "Pendentes"
5. **Som de alerta toca em loop** até o produtor reagir
6. Notificação visual (badge piscando + cor de destaque)
7. Produtor clica → modal de detalhes + botões:
   - "Aceitar pedido" → status = `preparing`, som para
   - "Recusar" → modal com motivo obrigatório
8. Pedido vai para coluna "Em preparo"
9. Quando pronto → "Marcar como pronto" → coluna "Prontos"
10. Quando saiu → "Saiu para entrega" → coluna "Em entrega"
11. Cliente vê tudo isso em tempo real no app dele

**Mesmo se o app estiver em segundo plano:** FCM dispara push notification do sistema operacional + toca som via Service Worker.

### Fluxo 3: Gestão do cardápio

1. Menu "Cardápio" na sidebar
2. Categorias na esquerda (drag-to-reorder)
3. Produtos da categoria selecionada na direita
4. CRUD de produtos:
   - Nome, descrição, preço (em centavos no banco; UI mostra "R$")
   - Foto (upload para Storage com redimensionamento)
   - Disponível: toggle (esgotado / pausa temporária)
   - Adicionais: grupos (ex: "Tamanho", "Complementos") com items
5. **Atualização imediata** — quando produtor marca como esgotado, consumidor vê na hora

### Fluxo 4: Configurações do produtor

- Dados básicos (nome, telefone, descrição)
- Endereço (com mapa pra confirmar pin)
- Horário de funcionamento por dia da semana
- Taxa de entrega (fixa, ou tabela por distância/CEP)
- Tempo médio de preparo
- Fotos (logo, banner)
- Status manual: aberto/fechado (sobrescreve horário automático)
- Métodos de pagamento aceitos
- Pedido mínimo

## Telas / Rotas

```
/                       Dashboard (KPIs do dia)
/pedidos                Tela principal — Kanban de pedidos
/pedidos/[orderId]      Detalhes do pedido
/pedidos/historico      Histórico com filtros

/cardapio               Gestão do cardápio
/cardapio/categorias    CRUD de categorias
/cardapio/produtos      CRUD de produtos
/cardapio/adicionais    CRUD de grupos de adicionais

/relatorios             Relatórios (vendas, produtos, etc.)
/financeiro             Faturamento, repasses (Etapa 5)

/configuracoes
/configuracoes/produtor     dados do produtor
/configuracoes/horarios        Horário de funcionamento
/configuracoes/entrega         Taxas e raio de entrega
/configuracoes/pagamentos      Métodos aceitos
/configuracoes/perfil          Perfil do operador

/login
/cadastro
/aguardando-aprovacao  (tela exibida se status === 'pending')
```

## Componentes-chave (deste app)

- `OrderKanban` — view em colunas (Pendentes / Preparo / Prontos / Em entrega)
- `OrderCard` — card de pedido (resumido)
- `OrderDetailModal` — modal completo de pedido com botões de ação
- `PrintableTicket` — comanda formatada para impressão térmica
- `MenuManager` — UI de cardápio com drag-and-drop
- `ProductEditor` — formulário rico de produto
- `SoundAlertProvider` — gerencia o áudio de alerta
- `OperationalStatusToggle` — botão grande "Aberto/Fechado"

## Sistema de alerta sonoro

```typescript
// Pseudo-código da lógica
const SoundAlertProvider = () => {
  useEffect(() => {
    const unsub = onSnapshot(
      query(ordersRef, where('produtorId', '==', myId), where('status', '==', 'confirmed')),
      (snapshot) => {
        const newOrders = snapshot.docChanges().filter(c => c.type === 'added')
        if (newOrders.length > 0) {
          playAlertSound({ loop: true })
          showNotificationBadge()
        }
      }
    )
    return unsub
  }, [])
}
```

**Importante:** browsers bloqueiam autoplay de áudio antes de interação do usuário. Solução: na primeira interação após login, "destravar" o contexto de áudio.

## Push Notifications (FCM)

- Registrar token FCM no login
- Salvar em `users/{uid}/fcmTokens`
- Cloud Function ao criar pedido → envia push para tokens do produtor
- Service Worker processa em background, toca som, mostra notificação do sistema

## Impressão Térmica

Estratégia: usar `window.print()` com CSS `@media print` específico para impressoras térmicas (largura 80mm). Funciona em Windows/macOS/Linux desde que o driver da impressora esteja instalado.

Para impressão direta sem diálogo (kiosk mode), o operador configura o Chrome com `--kiosk-printing`.

Layout da comanda:
- Cabeçalho: nome do produtor + nº do pedido + horário
- Cliente: nome + endereço
- Itens com adicionais
- Observações do cliente
- Totais
- Forma de pagamento
- Rodapé: tempo estimado / "Bom apetite!"

## Offline Resilience

- Service Worker faz cache do app shell
- IndexedDB para pedidos já carregados (visualização offline)
- Quando reconecta, `onSnapshot` reanexa automaticamente
- Banner visual "Sem conexão" quando navigator.onLine === false

