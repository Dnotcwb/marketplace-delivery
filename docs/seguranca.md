# Segurança

Tudo que envolve **autenticação, autorização, regras Firestore e proteção de rotas**.

## Princípios

1. **Deny by default.** Tudo começa proibido. Liberar com explícita justificativa.
2. **Defesa em camadas.** Regras Firestore + validação em Cloud Functions + UI restrita. Nunca confiar só na UI.
3. **Custom Claims como fonte de verdade de role.** Não usar campo no documento como autoridade — sempre `request.auth.token.role`.
4. **Server-side é a única fonte confiável.** Cálculo de preços, taxas, comissões: tudo na Cloud Function.
5. **Auditoria de ações destrutivas/admin.** Tudo registrado em `auditLogs`.

## Roles e Custom Claims

Quando um usuário faz login, o Firebase Auth gera um JWT que pode conter claims customizados:

```typescript
{
  role: 'cliente' | 'produtor' | 'admin' | 'entregador',
  produtorIds?: string[],    // só produtor
  approved?: boolean,          // produtor e entregador
}
```

**Claims só podem ser setadas pelo Admin SDK (server-side), nunca pelo client.** Isso é feito em Cloud Functions:

```typescript
// functions/src/auth/setUserRole.ts
export const setUserRole = onCall(async (request) => {
  // Apenas admin pode chamar
  if (request.auth?.token.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas admin')
  }

  const { uid, role, produtorIds, approved } = request.data

  await admin.auth().setCustomUserClaims(uid, {
    role,
    produtorIds,
    approved,
  })

  // Força refresh do token no próximo request do usuário
  await admin.firestore().collection('users').doc(uid).update({
    role,
    approved,
    updatedAt: FieldValue.serverTimestamp(),
  })
})
```

**Importante:** após mudar claims, o usuário precisa **renovar o token** para a mudança valer. No client:

```typescript
await firebase.auth().currentUser?.getIdToken(true) // força refresh
```

## Regras Firestore — estrutura completa

`firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ==================== HELPERS ====================
    function isAuthenticated() {
      return request.auth != null;
    }

    function userId() {
      return request.auth.uid;
    }

    function userRole() {
      return request.auth.token.role;
    }

    function isAdmin() {
      return isAuthenticated() && userRole() == 'admin';
    }

    function isCustomer() {
      return isAuthenticated() && userRole() == 'cliente';
    }

    function isProducer() {
      return isAuthenticated() && userRole() == 'produtor';
    }

    function isDriver() {
      return isAuthenticated() && userRole() == 'entregador';
    }

    function isApprovedProducer() {
      return isProducer() && request.auth.token.approved == true;
    }

    function isApprovedDriver() {
      return isDriver() && request.auth.token.approved == true;
    }

    function isOwnerOfProdutor(produtorId) {
      return isProducer() &&
             produtorId in request.auth.token.produtorIds;
    }

    function hasOnlyAllowedFields(allowedFields) {
      return request.resource.data.diff(resource.data)
              .affectedKeys()
              .hasOnly(allowedFields);
    }

    function isUnchanged(field) {
      return request.resource.data[field] == resource.data[field];
    }

    // ==================== USERS ====================
    match /users/{uid} {
      // Qualquer um pode criar a própria conta (signup)
      allow create: if isAuthenticated() && userId() == uid
                    && request.resource.data.role == 'cliente'  // default
                    && request.resource.data.uid == uid;

      // Ler: o próprio usuário, ou admin
      allow read: if userId() == uid || isAdmin();

      // Atualizar: o próprio (mas não pode mudar role/approved sozinho)
      allow update: if userId() == uid
                    && isUnchanged('role')
                    && isUnchanged('approved')
                    && isUnchanged('uid')
                    || isAdmin();

      // Excluir: só admin (e mesmo assim deve ser soft delete via Function)
      allow delete: if false;

      // Subcollections
      match /addresses/{addressId} {
        allow read, write: if userId() == uid;
      }

      match /fcmTokens/{tokenId} {
        allow read, write: if userId() == uid;
      }

      match /notifications/{notifId} {
        allow read: if userId() == uid;
        allow update: if userId() == uid
                      && hasOnlyAllowedFields(['read']);
        allow create, delete: if false; // só Cloud Functions
      }
    }

    // ==================== RESTAURANTS ====================
    match /produtores/{produtorId} {
      // Ler: qualquer um aprovado
      allow read: if resource.data.status == 'approved'
                  || isOwnerOfProdutor(produtorId)
                  || isAdmin();

      // Criar: produtor autenticado (mesmo não aprovado pode criar; vira pending)
      allow create: if isProducer()
                    && request.resource.data.ownerUid == userId()
                    && request.resource.data.status == 'pending';

      // Atualizar:
      // - dono do produtor: campos operacionais
      // - admin: tudo
      allow update: if (isOwnerOfProdutor(produtorId)
                       && isUnchanged('status')
                       && isUnchanged('commission')
                       && isUnchanged('approvedAt')
                       && isUnchanged('cnpj'))
                    || isAdmin();

      // Deletar: só admin (soft delete)
      allow delete: if false;

      // Subcollections
      match /categories/{categoryId} {
        allow read: if true;
        allow write: if isOwnerOfProdutor(produtorId) || isAdmin();
      }

      match /products/{productId} {
        allow read: if true;
        allow write: if isOwnerOfProdutor(produtorId) || isAdmin();
      }

      match /stats/{date} {
        allow read: if isOwnerOfProdutor(produtorId) || isAdmin();
        allow write: if false; // só Cloud Functions
      }
    }

    // ==================== ORDERS ====================
    match /orders/{orderId} {
      // Ler:
      // - cliente: seus pedidos
      // - produtor: pedidos do seu produtor
      // - entregador: pedidos atribuídos a ele
      // - admin: todos
      allow read: if (isCustomer() && resource.data.customerId == userId())
                  || (isProducer() && isOwnerOfProdutor(resource.data.produtorId))
                  || (isDriver() && resource.data.deliveryDriverId == userId())
                  || isAdmin();

      // Criar: APENAS via Cloud Function (assina como sistema)
      // Regra: bloquear todos os creates do client
      allow create: if false;

      // Atualizar:
      // - produtor: pode mudar status (mas só transições válidas)
      // - entregador: pode mudar status durante entrega
      // - admin: tudo
      // - cliente: pode cancelar se status == 'pending'
      allow update: if isAdmin()
                    || (isProducer()
                        && isOwnerOfProdutor(resource.data.produtorId)
                        && hasOnlyAllowedFields(['status', 'statusHistory',
                                                  'confirmedAt', 'preparingAt',
                                                  'readyAt', 'onDeliveryAt']))
                    || (isDriver()
                        && resource.data.deliveryDriverId == userId()
                        && hasOnlyAllowedFields(['status', 'statusHistory',
                                                  'driverLocation',
                                                  'driverLocationUpdatedAt',
                                                  'deliveredAt']))
                    || (isCustomer()
                        && resource.data.customerId == userId()
                        && resource.data.status == 'pending'
                        && request.resource.data.status == 'cancelled');

      // Deletar: NUNCA
      allow delete: if false;
    }

    // ==================== COUPONS ====================
    match /coupons/{couponCode} {
      // Ler: qualquer autenticado (para validar no checkout)
      // Apenas se ativo e dentro da validade
      allow read: if isAuthenticated();

      // Escrita: só admin
      allow write: if isAdmin();
    }

    // ==================== DELIVERY DRIVERS ====================
    match /deliveryDrivers/{driverId} {
      // Ler: próprio entregador, admin, ou produtor (durante entrega ativa)
      allow read: if (isDriver() && userId() == driverId)
                  || isAdmin();

      // Criar: o próprio entregador (signup)
      allow create: if isDriver()
                    && userId() == driverId
                    && request.resource.data.status == 'pending_approval';

      // Atualizar: próprio (campos limitados) ou admin
      allow update: if (isDriver() && userId() == driverId
                      && isUnchanged('status')
                      && isUnchanged('approvedAt'))
                    || isAdmin();

      // Deletar: NUNCA
      allow delete: if false;
    }

    // ==================== AUDIT LOGS ====================
    match /auditLogs/{logId} {
      // Apenas admin lê. Ninguém escreve direto (só Cloud Functions).
      allow read: if isAdmin();
      allow write: if false;
    }

    // ==================== APP CONFIG ====================
    match /appConfig/{docId} {
      // Qualquer um lê (para checar maintenance, etc.)
      allow read: if true;
      // Só admin escreve
      allow write: if isAdmin();
    }

    // ==================== DEFAULT DENY ====================
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Regras de Storage

`storage.rules`:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    function isAuthenticated() {
      return request.auth != null;
    }

    function isAdmin() {
      return isAuthenticated() && request.auth.token.role == 'admin';
    }

    function isImage() {
      return request.resource.contentType.matches('image/.*');
    }

    function sizeUnder(mb) {
      return request.resource.size < mb * 1024 * 1024;
    }

    // Avatares de usuário
    match /users/{uid}/avatar/{file} {
      allow read: if true;
      allow write: if request.auth.uid == uid && isImage() && sizeUnder(5);
    }

    // Logos e banners de produtor
    match /produtores/{produtorId}/{type}/{file} {
      allow read: if true;
      allow write: if isAuthenticated()
                   && (produtorId in request.auth.token.produtorIds || isAdmin())
                   && isImage()
                   && sizeUnder(10);
    }

    // Produtos
    match /produtores/{produtorId}/products/{productId}/{file} {
      allow read: if true;
      allow write: if isAuthenticated()
                   && (produtorId in request.auth.token.produtorIds || isAdmin())
                   && isImage()
                   && sizeUnder(5);
    }

    // Documentos (CNPJ, CNH) — privados
    match /documents/{uid}/{file} {
      allow read: if request.auth.uid == uid || isAdmin();
      allow write: if request.auth.uid == uid && sizeUnder(20);
    }

    // Default deny
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## Proteção de rotas (Next.js)

Cada app tem seu middleware. Padrão:

```typescript
// apps/<app>/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/cadastro', '/recuperar-senha']

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Rotas públicas passam
  if (PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.next()
  }

  // Verificar sessão (cookie do Firebase Auth)
  const session = request.cookies.get('__session')

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Para verificação de role, o middleware pode chamar a API:
  // /api/auth/verify que decodifica o cookie e checa role
  // (não dá pra usar Admin SDK direto no middleware — Edge Runtime)

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

No app `backoffice`, o middleware verifica `role === 'admin'`. No `produtor`, `role === 'produtor' && approved === true`. Etc.

## Verificação de role no client

Hook reutilizável em `shared-services`:

```typescript
// packages/shared-services/src/auth/useRequireRole.ts
export function useRequireRole(
  expectedRole: 'cliente' | 'produtor' | 'admin' | 'entregador',
  requireApproval = false
) {
  const { user, claims, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.replace('/login')
      return
    }

    if (claims?.role !== expectedRole) {
      router.replace('/acesso-negado')
      return
    }

    if (requireApproval && !claims?.approved) {
      router.replace('/aguardando-aprovacao')
    }
  }, [user, claims, loading])

  return { user, claims, loading }
}
```

## Sanitização e validação

- **Toda entrada do usuário** passa por Zod antes de chegar no Firestore
- HTML do usuário (descrições, comentários) é sanitizado com `DOMPurify` antes de renderizar
- Inputs numéricos têm `min`/`max` no client **E** validação no server (Cloud Function)
- Uploads: validar tipo MIME e tamanho **no client** (UX) **e nas regras de Storage** (segurança)

## Headers de segurança

Cada app deve ter no `next.config.js`:

```javascript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        // CSP detalhada — ajustar por app
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' https: data:; ..." },
      ],
    },
  ]
}
```

## Rate limiting

Para Cloud Functions HTTP (webhooks, callables):

- Configurar via App Check
- Limites por IP e por uid em Functions sensíveis (signup, create order)
- Mercado Pago webhook: validar **assinatura HMAC** antes de processar

## LGPD

- Consentimento explícito no signup
- Direito ao esquecimento via solicitação → Cloud Function anonimiza
- Exportação de dados pessoais via Cloud Function (gera JSON com tudo do usuário)
- Política de privacidade em página pública dos 4 apps
- Cookies essenciais vs. opcionais com banner de consentimento

## Checklist de segurança por nova feature

Antes de mergear feature nova, verificar:

- [ ] Regras Firestore atualizadas para as collections envolvidas?
- [ ] Cloud Functions têm verificação de role?
- [ ] Validação Zod em todos os inputs?
- [ ] Sanitização de outputs HTML (se aplicável)?
- [ ] Auditoria registrada para ações admin?
- [ ] Rate limiting onde necessário?
- [ ] Testes com usuário não autorizado falhando?


