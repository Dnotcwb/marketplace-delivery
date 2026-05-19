# App Entregador

> ⚠️ **Este app é parte da Etapa 6.** Não construir antes de concluir Etapas 1-5.

Aplicação destinada aos **entregadores** (motoboys / ciclistas) que retiram pedidos no restaurante e entregam ao cliente.

## Características-chave

- **Mobile-first absoluto.** 100% dos usuários usam celular durante o trabalho.
- **Geolocalização constante.** Mas em foreground (PWA não tem background GPS confiável).
- **Baixo consumo de bateria.** Telas escuras, polling econômico, GPS otimizado.
- **Notificações push agressivas.** Nova entrega disponível precisa ser percebida.
- **PWA agora; React Native no futuro (Etapa 7+).**

## Limitações conhecidas do PWA neste cenário

| Necessidade | PWA consegue? | Workaround |
|-------------|---------------|------------|
| Push notification | ✅ via FCM | OK |
| GPS em foreground | ✅ | OK |
| **GPS em background** | ❌ | Manter app aberto (tela "ativa") |
| Vibração | ✅ | API Vibration |
| Som mesmo silencioso | ❌ | Limitação inerente |
| Acesso à câmera | ✅ | Para foto de comprovante de entrega |

Por essas limitações, **a Etapa 7+ inclui versão React Native**. Para o MVP (Etapa 6), PWA com a "tela sempre ativa" via Wake Lock API é suficiente.

## Stack específica deste app

- Next.js 15 com renderização exclusivamente client-side
- `next-pwa` em modo agressivo
- **Wake Lock API** para manter tela ativa enquanto entregando
- **Geolocation API** com `watchPosition`
- Service Worker custom para receber pushes em background

## Fluxos Principais

### Fluxo 1: Onboarding

1. Cadastro com dados pessoais + CNH + dados do veículo + foto
2. Status `pending_approval`
3. Admin aprova no backoffice
4. Entregador recebe email → faz login

### Fluxo 2: Entrega completa (CRÍTICO)

1. Entregador faz login → tela "Disponível"
2. Toggle "Disponível para corridas" → liga
3. Geolocation começa a reportar posição a cada 30s para Firestore
4. Quando há pedido `on_delivery` próximo:
   - Push notification + alerta sonoro + vibração
   - Tela mostra: restaurante, distância, valor da corrida
   - Botões: "Aceitar" (15s para responder) / "Recusar"
5. **Aceitou:**
   - Pedido vira `assigned_to_driver`, com `driverId` setado
   - Mapa com rota até o restaurante
   - Status do entregador: `going_to_pickup`
6. Chegou no restaurante → botão "Cheguei no restaurante"
7. Coletou → botão "Coletei o pedido" → status `picked_up`
8. Mapa com rota até o cliente
9. Status do entregador: `delivering`
10. Chegou no cliente → botão "Cheguei no destino"
11. Confirmação de entrega:
    - Foto opcional (comprovante)
    - Código de 4 dígitos que o cliente vê no app dele (validação)
12. Pedido vira `delivered`
13. Ganho da corrida vai para "Saldo pendente"

### Fluxo 3: Ganhos

- Tela `/ganhos` com:
  - Saldo disponível
  - Saldo pendente (a liberar)
  - Histórico de corridas
  - Gráfico de ganhos por dia
- Saque (futuro — Etapa 7+)

## Telas / Rotas

```
/                          Home — "Disponível" toggle + mapa
/entrega/[orderId]         Tela da entrega ativa (mapa + estado)
/historico                 Histórico de entregas
/ganhos                    Painel financeiro
/perfil                    Dados pessoais e do veículo
/configuracoes             Preferências (áreas, raio máximo)

/login
/cadastro
/aguardando-aprovacao
```

## Tela principal — Mapa e Estado

A tela principal tem dois estados:

**Estado A: Aguardando entrega**
- Toggle "Disponível" no topo
- Mapa mostrando localização atual + restaurantes próximos com pedidos prontos
- Card flutuante de estatísticas do dia (corridas, ganhos)

**Estado B: Em entrega**
- Mapa em tela cheia com rota
- Card inferior com:
  - Próxima ação ("Buscar no restaurante" / "Entregar ao cliente")
  - Endereço de destino
  - Botão grande de ação ("Cheguei")
- Telefone do cliente / restaurante (1-tap to call)
- Chat (futuro)

## Algoritmo de matching (Cloud Function)

Quando um pedido vira `on_delivery`, dispara `findAvailableDriver`:

```typescript
async function findAvailableDriver(orderId: string) {
  const order = await getOrder(orderId)
  const restaurant = await getRestaurant(order.restaurantId)

  // Busca entregadores disponíveis num raio de 5km do restaurante
  const drivers = await getAvailableDriversNear(
    restaurant.location,
    radiusKm: 5
  )

  // Ordena por: ativo + próximo + maior aceitação histórica
  const ranked = rankDrivers(drivers, order)

  // Oferece para o primeiro, com 15s de timeout
  for (const driver of ranked) {
    const accepted = await offerOrderToDriver(driver, order, timeoutSec: 15)
    if (accepted) return driver
  }

  // Ninguém aceitou → escala raio ou notifica admin
  await escalateUnassignedOrder(orderId)
}
```

## Geolocalização — privacidade

- Localização só é coletada quando entregador está com toggle "Disponível: ON"
- Cliente vê localização do entregador apenas durante a entrega ativa
- Histórico de localização **não** é persistido (privacidade)
- Apenas pontos agregados (início, retirada, entrega) ficam no pedido

## Wake Lock para manter tela ativa

```typescript
// Pseudo-código
useEffect(() => {
  let wakeLock: WakeLockSentinel | null = null

  if (deliveryActive) {
    navigator.wakeLock?.request('screen').then(lock => {
      wakeLock = lock
    })
  }

  return () => wakeLock?.release()
}, [deliveryActive])
```

## Componentes-chave (deste app)

- `AvailabilityToggle` — toggle grande "Disponível"
- `OfferModal` — modal de oferta de corrida (15s countdown)
- `DeliveryMap` — mapa com rota (Google Maps ou Mapbox)
- `DeliveryStateCard` — card inferior com próxima ação
- `EarningsChart` — gráfico de ganhos
- `LocationTracker` — Provider que reporta posição

## Integração com mapas

**Recomendação:** Mapbox para visualização, Google Maps Directions API para rota.

Razão: Google Maps Display é caro; Mapbox tem free tier generoso. Mas Google é melhor para roteamento real (considera trânsito, ruas restritas, etc.).

Alternativa econômica: **OpenStreetMap + OSRM** (gratuito, mas qualidade variável no Brasil).

## Notificações sensíveis

Configurar canais distintos no FCM:

- `delivery_offer` — alta prioridade, som de alerta + vibração + persistente
- `delivery_update` — média prioridade, som suave
- `general` — baixa prioridade
