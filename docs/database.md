# Modelagem do Banco — Firestore

Este documento define **todas as collections**, seus campos, relacionamentos e índices. Antes de criar/alterar qualquer estrutura no Firestore, atualize aqui.

## Princípios de modelagem

1. **NoSQL não é SQL.** Não tente normalizar tudo — duplicar dados é normal e desejável quando ajuda na leitura.
2. **Otimizar para leitura.** Escrever em vários lugares (denormalização) custa pouco; ler vários documentos custa caro.
3. **Valores monetários em centavos (int).** Sempre. Sem exceção.
4. **Timestamps via `serverTimestamp()`**. Nunca confiar no clock do cliente.
5. **IDs auto-gerados pelo Firestore**, exceto quando precisar de slug/code (cupom, restaurant slug).
6. **Soft delete** (`deletedAt`) em vez de hard delete sempre que possível.
7. **Subcollections** para dados que pertencem fortemente ao parent e quase nunca são consultados isoladamente.

## Diagrama de relacionamentos

```
users ────┐
          ├─ owns ──> restaurants ──┬─ contains ──> products
          │                          ├─ contains ──> categories
          │                          └─ has ─────── stats/{date}
          │
          ├─ creates ─> orders ────┬─ items[]
          │                        ├─ payment
          │                        ├─ deliveryDriverId
          │                        └─ statusHistory[]
          │
          ├─ has ─> addresses (subcollection)
          ├─ has ─> fcmTokens (subcollection)
          └─ has ─> notifications (subcollection)

coupons (standalone)
deliveryDrivers (standalone, mas userId vincula a users)
auditLogs (standalone)
appConfig (standalone, doc único)
```

## Collections

### `users/{uid}`

Dados de qualquer usuário (cliente, produtor, admin ou entregador). UID vem do Firebase Auth.

```typescript
interface User {
  uid: string                  // === doc id, === Auth UID
  email: string
  emailVerified: boolean
  phone?: string
  phoneVerified: boolean
  name: string
  cpf?: string                 // criptografado quando armazenado
  birthDate?: Timestamp
  photoUrl?: string

  role: 'cliente' | 'produtor' | 'admin' | 'entregador'
  // role principal — também vai como custom claim no Auth

  // Específico por role
  restaurantIds?: string[]     // produtor: restaurantes que gerencia
  approved?: boolean           // produtor/entregador: aprovado pelo admin
  approvedAt?: Timestamp
  approvedBy?: string          // uid do admin que aprovou

  createdAt: Timestamp
  updatedAt: Timestamp
  lastLoginAt?: Timestamp
  deletedAt?: Timestamp        // soft delete

  // Preferências
  preferences?: {
    notifications: {
      push: boolean
      email: boolean
      sms: boolean
      promotional: boolean
    }
  }
}
```

#### Subcollections de `users`

##### `users/{uid}/addresses/{addressId}`

```typescript
interface Address {
  id: string
  label: string                // "Casa", "Trabalho"
  cep: string                  // só números
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  state: string                // sigla UF
  reference?: string
  geo: GeoPoint                // lat/lng
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

##### `users/{uid}/fcmTokens/{tokenId}`

```typescript
interface FcmToken {
  token: string
  platform: 'web' | 'android' | 'ios'
  app: 'consumidor' | 'produtor' | 'backoffice' | 'entregador'
  deviceInfo?: string
  createdAt: Timestamp
  lastUsedAt: Timestamp
}
```

##### `users/{uid}/notifications/{notifId}`

```typescript
interface Notification {
  id: string
  type: 'order_status' | 'promotion' | 'system' | 'approval'
  title: string
  body: string
  data?: Record<string, any>
  read: boolean
  createdAt: Timestamp
  expiresAt?: Timestamp
}
```

---

### `restaurants/{restaurantId}`

```typescript
interface Restaurant {
  id: string
  slug: string                 // url-friendly, único
  name: string
  description?: string
  cnpj: string
  ownerUid: string             // referência ao produtor principal

  category: string             // 'pizza' | 'hamburguer' | 'japonesa' | ...
  cuisineTags: string[]

  logoUrl?: string
  bannerUrl?: string
  galleryUrls?: string[]

  address: {
    cep: string
    street: string
    number: string
    complement?: string
    neighborhood: string
    city: string
    state: string
    geo: GeoPoint              // para queries geo
  }

  phone: string
  whatsapp?: string

  // Operação
  status: 'pending' | 'approved' | 'suspended'
  isOpen: boolean              // override manual
  acceptsOrders: boolean

  openingHours: {
    monday: { open: string; close: string; isOpen: boolean } | null
    tuesday: { ... }
    // ... wednesday, thursday, friday, saturday, sunday
  }

  // Entrega
  delivery: {
    type: 'fixed' | 'by_distance'
    fixedFee?: number          // centavos
    perKmFee?: number          // centavos por km
    freeAbove?: number         // valor mínimo para frete grátis
    minOrder: number           // pedido mínimo em centavos
    radiusKm: number           // raio máximo de entrega
    estimatedTimeMin: number   // tempo estimado em minutos
  }

  paymentMethods: {
    pix: boolean
    creditCard: boolean
    debitCard: boolean
    cashOnDelivery: boolean
    cardOnDelivery: boolean
  }

  // Estatísticas (desnormalizadas para performance)
  stats: {
    rating: number             // média 0-5
    reviewCount: number
    orderCount: number
    lastOrderAt?: Timestamp
  }

  // Comissão da plataforma
  commission: {
    percentage: number         // ex: 12 = 12%
    effectiveSince: Timestamp
  }

  // Fiscal (preparação Focus NFe)
  fiscal?: {
    enabled: boolean
    cnpj: string
    inscricaoEstadual?: string
    inscricaoMunicipal?: string
    regimeTributario?: string
    // tokens da Focus NFe vão em variáveis de ambiente
  }

  createdAt: Timestamp
  updatedAt: Timestamp
  approvedAt?: Timestamp
  deletedAt?: Timestamp
}
```

#### Subcollections de `restaurants`

##### `restaurants/{restaurantId}/categories/{categoryId}`

```typescript
interface Category {
  id: string
  name: string                 // "Bebidas", "Sobremesas"
  description?: string
  order: number                // ordem de exibição
  imageUrl?: string
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

##### `restaurants/{restaurantId}/products/{productId}`

```typescript
interface Product {
  id: string
  categoryId: string
  name: string
  description?: string
  price: number                // centavos
  promotionalPrice?: number    // centavos
  imageUrl?: string
  imageUrls?: string[]

  available: boolean           // toggle "esgotado"
  visible: boolean             // visível no cardápio

  // Adicionais
  addonGroups?: AddonGroup[]

  // Nutricional (opcional)
  nutritional?: {
    calories?: number
    portion?: string
  }

  tags?: string[]              // 'vegetariano', 'sem-glúten', 'novo'

  stats: {
    orderCount: number
    rating?: number
  }

  createdAt: Timestamp
  updatedAt: Timestamp
  deletedAt?: Timestamp
}

interface AddonGroup {
  id: string
  name: string                 // "Tamanho", "Adicionais"
  required: boolean
  minSelection: number
  maxSelection: number
  options: AddonOption[]
}

interface AddonOption {
  id: string
  name: string
  priceModifier: number        // centavos, pode ser negativo (desconto)
  available: boolean
}
```

##### `restaurants/{restaurantId}/stats/{yyyy-MM-dd}`

```typescript
interface DailyStats {
  date: string                 // "2026-05-19"
  orderCount: number
  gmv: number                  // gross merchandise value, centavos
  netRevenue: number           // após desconto da comissão
  cancelledCount: number
  averageTicket: number
  topProducts: { productId: string; count: number }[]
  hourlyDistribution: number[] // 24 posições
}
```

---

### `orders/{orderId}`

Pedidos — a collection mais crítica do sistema.

```typescript
interface Order {
  id: string
  orderNumber: number          // sequencial humano-amigável

  // Quem fez
  customerId: string           // uid do cliente
  customerSnapshot: {          // snapshot no momento do pedido
    name: string
    email: string
    phone: string
  }

  // De onde
  restaurantId: string
  restaurantSnapshot: {
    name: string
    slug: string
    address: { ... }
  }

  // O que
  items: OrderItem[]

  // Para onde
  deliveryAddress: Address     // copy do endereço escolhido
  deliveryType: 'delivery' | 'pickup'

  // Quanto
  pricing: {
    subtotal: number           // soma dos itens
    deliveryFee: number
    discount: number           // valor do cupom
    serviceFee?: number        // taxa de serviço (futuro)
    total: number              // subtotal + delivery + service - discount
    platformCommission: number // o que a plataforma fica
    restaurantNet: number      // o que o restaurante recebe
  }

  // Cupom usado (se houver)
  coupon?: {
    code: string
    discountType: 'fixed' | 'percentage'
    discountValue: number
  }

  // Pagamento
  payment: {
    method: 'pix' | 'credit_card' | 'debit_card' | 'cash' | 'card_on_delivery'
    status: 'pending' | 'approved' | 'rejected' | 'refunded'
    mercadoPagoId?: string
    pixCode?: string           // copy-paste do PIX
    pixQrCodeUrl?: string
    paidAt?: Timestamp
    refundedAt?: Timestamp
  }

  // Status e histórico
  status: OrderStatus
  statusHistory: StatusChange[]

  // Tempos
  createdAt: Timestamp
  confirmedAt?: Timestamp
  preparingAt?: Timestamp
  readyAt?: Timestamp
  onDeliveryAt?: Timestamp
  deliveredAt?: Timestamp
  cancelledAt?: Timestamp

  estimatedDeliveryTime?: Timestamp
  customerNotes?: string

  // Entregador
  deliveryDriverId?: string
  deliveryDriverSnapshot?: {
    name: string
    phone: string
    photoUrl?: string
    vehicleInfo: string
  }

  // Geolocalização ao vivo (apenas quando entregando)
  driverLocation?: GeoPoint
  driverLocationUpdatedAt?: Timestamp

  // Cancelamento
  cancellation?: {
    reason: string
    cancelledBy: 'customer' | 'restaurant' | 'admin' | 'system'
    cancelledByUid?: string
    refundIssued: boolean
  }

  // Avaliação (preenchida na Etapa 6)
  review?: {
    rating: number             // 1-5
    comment?: string
    createdAt: Timestamp
    restaurantReply?: string
  }

  // Fiscal
  invoice?: {
    issued: boolean
    nfeNumber?: string
    nfeUrl?: string
  }
}

type OrderStatus =
  | 'pending'                  // aguardando pagamento
  | 'confirmed'                // pagamento OK, esperando restaurante aceitar
  | 'accepted'                 // restaurante aceitou
  | 'preparing'                // em preparo
  | 'ready'                    // pronto para retirada/entrega
  | 'on_delivery'              // saiu para entrega
  | 'delivered'                // entregue
  | 'cancelled'                // cancelado

interface OrderItem {
  productId: string
  productSnapshot: {
    name: string
    imageUrl?: string
  }
  quantity: number
  unitPrice: number            // centavos
  addons: {
    groupId: string
    groupName: string
    optionId: string
    optionName: string
    priceModifier: number
  }[]
  notes?: string
  itemTotal: number            // (unitPrice + sum(addons)) * quantity
}

interface StatusChange {
  status: OrderStatus
  at: Timestamp
  by: 'system' | 'customer' | 'restaurant' | 'admin'
  byUid?: string
  reason?: string
}
```

---

### `coupons/{couponCode}`

Doc ID = código do cupom em maiúsculas.

```typescript
interface Coupon {
  code: string                 // === doc id
  description: string

  discountType: 'fixed' | 'percentage'
  discountValue: number        // centavos (fixed) ou número 0-100 (percentage)
  maxDiscount?: number         // teto em centavos para %

  validFrom: Timestamp
  validUntil: Timestamp

  usageLimit?: number          // total de usos
  usageLimitPerUser?: number   // por usuário
  usedCount: number            // contador atualizado via Cloud Function

  minOrderValue?: number       // pedido mínimo

  // Restrições
  restaurantIds?: string[]     // null = todos
  firstOrderOnly?: boolean
  newUsersOnly?: boolean

  active: boolean

  createdAt: Timestamp
  createdBy: string            // uid do admin
  updatedAt: Timestamp
}
```

---

### `deliveryDrivers/{driverId}`

`driverId` = UID do Auth.

```typescript
interface DeliveryDriver {
  uid: string                  // === doc id
  userId: string               // ref ao users/

  cnh: string
  cnhCategory: string
  cnhExpiresAt: Timestamp

  vehicle: {
    type: 'motorcycle' | 'bicycle' | 'car'
    plate?: string
    model?: string
    color?: string
  }

  status: 'pending_approval' | 'approved' | 'suspended'
  available: boolean           // toggle "Disponível"

  currentLocation?: GeoPoint
  locationUpdatedAt?: Timestamp

  stats: {
    totalDeliveries: number
    rating: number
    acceptanceRate: number     // % de ofertas aceitas
    cancellationRate: number
  }

  // Financeiro
  balance: {
    available: number          // centavos
    pending: number
    totalEarned: number
  }

  bankInfo?: {                 // criptografado
    bank: string
    agency: string
    account: string
    pixKey?: string
  }

  createdAt: Timestamp
  approvedAt?: Timestamp
  updatedAt: Timestamp
}
```

---

### `auditLogs/{logId}`

Imutável. Apenas Cloud Functions escrevem; backoffice apenas lê.

```typescript
interface AuditLog {
  id: string
  adminUid: string
  adminEmail: string
  action: string               // 'restaurant.approve', 'order.cancel', ...
  targetType: string
  targetId: string
  before?: Record<string, any>
  after?: Record<string, any>
  reason?: string
  ip: string
  userAgent?: string
  timestamp: Timestamp
}
```

---

### `appConfig/{singleton}`

Doc único com ID `config`. Configurações globais da plataforma.

```typescript
interface AppConfig {
  defaultCommissionPercentage: number
  minOrderValue: number
  maxDeliveryRadius: number

  payment: {
    pixEnabled: boolean
    creditCardEnabled: boolean
    debitCardEnabled: boolean
  }

  features: {
    couponsEnabled: boolean
    reviewsEnabled: boolean
    favoritesEnabled: boolean
  }

  maintenance: {
    enabled: boolean
    message?: string
    affectedApps: string[]     // ['consumidor', 'produtor', ...]
  }

  updatedAt: Timestamp
  updatedBy: string
}
```

---

## Índices Compostos

Configurar em `firestore.indexes.json`. O Firestore avisa quando uma query precisa de índice — anote aqui quando criar.

### Críticos desde o início

```
orders:
  - (customerId ASC, createdAt DESC)              # histórico do cliente
  - (restaurantId ASC, status ASC, createdAt DESC) # pedidos do restaurante
  - (status ASC, createdAt ASC)                    # admin global
  - (deliveryDriverId ASC, status ASC)             # entregas do motoboy

products:
  - (categoryId ASC, available ASC, order ASC)

restaurants:
  - (status ASC, category ASC)
  - (status ASC, isOpen ASC)

coupons:
  - (active ASC, validUntil ASC)
```

## Queries geo

Para "restaurantes próximos", usar uma das duas estratégias:

**Estratégia 1: Bounding box (mais simples)**
Calcular bounding box no client e fazer query `>=` e `<=` nas coordenadas. Funciona bem para raios pequenos.

**Estratégia 2: Geohash (mais robusto, recomendado)**
Adicionar campo `geohash` (string) em `restaurants` e usar a lib `geofire-common` para encontrar candidatos. Não é perfeito mas escala muito melhor.

```typescript
// Decisão: usar geohash desde a Etapa 2
import { geohashForLocation, geohashQueryBounds } from 'geofire-common'

// Ao salvar restaurante:
const geohash = geohashForLocation([lat, lng])
// salva junto com geo: GeoPoint

// Ao buscar próximos:
const bounds = geohashQueryBounds(center, radiusInM)
// faz uma query por bound, filtra no client por distância real
```

## Padrões de denormalização

Decisões já tomadas para evitar joins caros:

- **`orders` carrega snapshot do cliente, restaurante e endereço** no momento do pedido. Se restaurante mudar nome depois, pedidos antigos mantêm o nome original.
- **`orders.items` tem snapshot do produto** (nome, foto, preço). Se produto for excluído, pedido continua válido.
- **`restaurants.stats.rating`** é desnormalizado — atualizado via Cloud Function quando avaliação é criada.
- **`coupons.usedCount`** é incrementado atomicamente via `FieldValue.increment(1)`.

## Padrões de exclusão

- **Restaurantes:** soft delete (`deletedAt`). Histórico de pedidos continua referenciando.
- **Produtos:** soft delete. Pedidos antigos não quebram.
- **Pedidos:** **nunca** são excluídos. Apenas `cancelled`.
- **Usuários:** soft delete. Dados pessoais são anonimizados após 30 dias (LGPD).

## Limitações conhecidas do Firestore

- **1 escrita por documento por segundo** sob contenção alta. Para contadores quentes, usar **distributed counters** (subcollection).
- **Documento máximo 1MB.** Atenção em `orders` com muitos itens — limitar a ~100 itens.
- **Sem joins reais.** Por isso a denormalização.
- **Queries não suportam OR entre campos diferentes** (até 2024 sim, mas com limites). Pode precisar de múltiplas queries em paralelo.
- **`array-contains`** funciona, mas só um por query.
