# Setup Inicial — Criando o Monorepo do Zero

Este documento é um **roteiro executável**. Quando o Claude Code começar a Etapa 1, ele segue este passo a passo.

> **Antes de tudo:** garanta Node.js 22+ e pnpm 9+ instalados.
> ```bash
> node --version    # v22.x.x ou superior
> pnpm --version    # 9.x.x ou superior
> ```
> Se não tiver pnpm: `npm install -g pnpm`

---

## Passo 1 — Criar a pasta raiz e o `package.json` raiz

```bash
mkdir marketplace-delivery
cd marketplace-delivery
git init
```

Criar `package.json` na raiz:

```json
{
  "name": "marketplace-delivery",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "firebase:emulators": "firebase emulators:start",
    "firebase:deploy:rules": "firebase deploy --only firestore:rules,storage",
    "firebase:deploy:functions": "firebase deploy --only functions"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.3.0",
    "typescript": "^5.5.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## Passo 2 — Configurar workspaces do pnpm

Criar `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "functions"
```

---

## Passo 3 — Configurar Turborepo

Criar `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      "env": ["NEXT_PUBLIC_*", "NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

---

## Passo 4 — Criar a estrutura de pastas

```bash
mkdir -p apps packages functions docs
mkdir -p packages/shared-types/src
mkdir -p packages/shared-firebase/src
mkdir -p packages/shared-ui/src
mkdir -p packages/shared-services/src
mkdir -p packages/shared-utils/src
mkdir -p packages/shared-config
```

---

## Passo 5 — Criar `.gitignore` raiz

```gitignore
# Dependências
node_modules
.pnpm-store

# Builds
.next
out
dist
build
*.tsbuildinfo

# Turborepo
.turbo

# Env (NUNCA commitar)
.env
.env.local
.env.*.local
!.env.example

# Firebase
.firebase
*-debug.log
firebase-debug.log
firestore-debug.log
ui-debug.log

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Testes
coverage
.nyc_output
```

---

## Passo 6 — Configurar shared-config (ESLint, Prettier, TS base)

`packages/shared-config/package.json`:

```json
{
  "name": "@marketplace/shared-config",
  "version": "0.0.0",
  "private": true,
  "files": [
    "eslint",
    "typescript",
    "prettier"
  ]
}
```

Dentro de `packages/shared-config/`, criar três subpastas com arquivos base de configuração:

- `typescript/base.json` — tsconfig base estrito
- `typescript/nextjs.json` — extends do base, para apps Next.js
- `typescript/react-library.json` — extends do base, para packages que exportam React
- `eslint/base.js` — ESLint base
- `eslint/next.js` — ESLint para Next.js
- `prettier/index.js` — Prettier base

> **Atenção Claude Code:** o conteúdo exato desses arquivos é gerado durante a execução da Etapa 1. O importante é a estrutura.

---

## Passo 7 — Criar packages compartilhados (esqueleto)

Para **cada** package em `packages/shared-*`, criar:

`packages/shared-XXX/package.json`:

```json
{
  "name": "@marketplace/shared-XXX",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint src --max-warnings 0",
    "typecheck": "tsc --noEmit"
  }
}
```

`packages/shared-XXX/tsconfig.json`:

```json
{
  "extends": "@marketplace/shared-config/typescript/base.json",
  "include": ["src/**/*"]
}
```

`packages/shared-XXX/src/index.ts` (vazio inicialmente, populado conforme avança):

```typescript
// Exports do package
```

---

## Passo 8 — Criar os 3 apps Next.js iniciais

```bash
cd apps

# Consumidor (porta 3000)
pnpm create next-app@latest consumidor \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --use-pnpm --no-eslint

# Produtor (porta 3001)
pnpm create next-app@latest produtor \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --use-pnpm --no-eslint

# Backoffice (porta 3002)
pnpm create next-app@latest backoffice \
  --typescript --tailwind --app --src-dir \
  --import-alias "@/*" --use-pnpm --no-eslint
```

**Não criar o `entregador` agora.** Ele é só na Etapa 6.

Para cada app criado:

1. Renomear `name` em `package.json` para `@marketplace/consumidor`, `@marketplace/produtor`, `@marketplace/backoffice`
2. Adicionar dependências dos packages compartilhados:
   ```json
   "dependencies": {
     "@marketplace/shared-types": "workspace:*",
     "@marketplace/shared-firebase": "workspace:*",
     "@marketplace/shared-ui": "workspace:*",
     "@marketplace/shared-services": "workspace:*",
     "@marketplace/shared-utils": "workspace:*"
   }
   ```
3. Ajustar `next dev` para usar porta correta:
   - consumidor: `"dev": "next dev -p 3000"`
   - produtor: `"dev": "next dev -p 3001"`
   - backoffice: `"dev": "next dev -p 3002"`
4. Adicionar `lint` e `typecheck` scripts em cada `package.json`

---

## Passo 9 — Instalar tudo e validar

Voltar para a raiz:

```bash
cd ..
pnpm install
```

Isso resolve todos os workspaces e cria os links simbólicos entre packages.

Validar:

```bash
pnpm dev   # deve subir os 3 apps em paralelo, cada um na sua porta
```

Acessar:
- http://localhost:3000 — consumidor
- http://localhost:3001 — produtor
- http://localhost:3002 — backoffice

Todos devem mostrar a página padrão do Next.js.

---

## Passo 10 — Configurar Firebase

```bash
# Instalar Firebase CLI globalmente (se ainda não tiver)
npm install -g firebase-tools

# Login
firebase login

# Inicializar Firebase na raiz do monorepo
firebase init
```

Selecionar:
- ✅ Firestore
- ✅ Functions
- ✅ Storage
- ✅ Emulators

Configurações:
- Functions language: **TypeScript**
- Functions directory: `functions`
- Emulators: Auth, Functions, Firestore, Storage
- Portas padrão dos emuladores (deixar as default)
- UI: Sim, na porta 4000

Resultado esperado: `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `storage.rules`, pasta `functions/` populada.

---

## Passo 11 — Configurar Firestore Rules iniciais (modo restritivo)

`firestore.rules`:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Por padrão, NADA é acessível. As regras detalhadas
    // serão adicionadas em docs/seguranca.md conforme as
    // collections forem sendo criadas.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Filosofia: **deny by default**. Liberar acesso apenas para o que está explicitamente permitido. Detalhes em `docs/seguranca.md`.

---

## Passo 12 — Primeiro commit

```bash
git add .
git commit -m "infra: configura monorepo Turborepo + pnpm com 3 apps"
```

Criar repositório no GitHub e fazer push:

```bash
git remote add origin <URL-do-repo>
git branch -M main
git push -u origin main
```

---

## Passo 13 — Configurar Netlify (1 site por app)

Para cada app:

1. Conectar repositório GitHub
2. Configurar build:
   - **Base directory:** `apps/consumidor` (ou produtor / backoffice)
   - **Build command:** `cd ../.. && pnpm build --filter=@marketplace/consumidor`
   - **Publish directory:** `apps/consumidor/.next`
3. Variáveis de ambiente: adicionar todas as `NEXT_PUBLIC_FIREBASE_*` (valores reais do projeto Firebase)
4. Instalar plugin `@netlify/plugin-nextjs` no app

> Detalhes completos em `docs/integracoes.md`.

---

## Checklist de Conclusão da Etapa 1

Marque cada item conforme conclui. Estrutura repetida em `docs/etapas.md`.

- [ ] Monorepo criado com Turborepo + pnpm
- [ ] 3 apps Next.js rodando (consumidor:3000, produtor:3001, backoffice:3002)
- [ ] 6 packages compartilhados criados (types, firebase, ui, services, utils, config)
- [ ] Firebase configurado (Firestore, Auth, Storage, Functions, Emulators)
- [ ] `firestore.rules` em modo deny-by-default
- [ ] `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` todos passam
- [ ] Repositório no GitHub
- [ ] 3 sites criados na Netlify (mesmo sem domínio próprio ainda)
- [ ] `.env.local` criado em cada app (com variáveis do Firebase preenchidas)
- [ ] `CLAUDE.md` — atualizar seção "Status Atual" marcando Etapa 1 ✅
