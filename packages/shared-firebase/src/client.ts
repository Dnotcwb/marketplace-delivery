import { getApps, initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'
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
export const firestore = getFirestore(app)
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
