import { getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { connectStorageEmulator, getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env['NEXT_PUBLIC_FIREBASE_API_KEY']!,
  authDomain: process.env['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN']!,
  projectId: process.env['NEXT_PUBLIC_FIREBASE_PROJECT_ID']!,
  storageBucket: process.env['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET']!,
  messagingSenderId: process.env['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID']!,
  appId: process.env['NEXT_PUBLIC_FIREBASE_APP_ID']!,
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!

export const auth = getAuth(app)

/**
 * Firestore com **cache local persistente (IndexedDB)** no navegador.
 *
 * Por quê: sem cache, cada `onSnapshot` ao trocar de tela re-baixa a coleção
 * da rede (spinner a cada navegação). Com o cache persistente, o snapshot é
 * servido instantaneamente do IndexedDB e a rede só revalida em segundo plano
 * — a navegação entre telas fica imediata. `persistentMultipleTabManager`
 * compartilha o cache entre abas sem conflito.
 *
 * No servidor (SSR) não há IndexedDB → usa `getFirestore` padrão.
 * O try/catch protege contra reinicialização em hot-reload (HMR).
 */
function initFirestore() {
  if (typeof window === 'undefined') return getFirestore(app)
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    // Já inicializado nesta sessão (HMR) — reaproveita a instância existente.
    return getFirestore(app)
  }
}

export const firestore = initFirestore()
export const storage = getStorage(app)
export const functions = getFunctions(app, 'southamerica-east1')

// Conecta aos emuladores apenas quando NEXT_PUBLIC_USE_EMULATORS=true
if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && typeof window !== 'undefined') {
  const isEmulatorConnected = (auth as unknown as { _canInitEmulator?: boolean })
    ._canInitEmulator !== false

  if (isEmulatorConnected) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
      connectFirestoreEmulator(firestore, 'localhost', 8080)
      connectStorageEmulator(storage, 'localhost', 9199)
      connectFunctionsEmulator(functions, 'localhost', 5001)
    } catch {
      // Emuladores já conectados em hot-reload — ignorar
    }
  }
}
