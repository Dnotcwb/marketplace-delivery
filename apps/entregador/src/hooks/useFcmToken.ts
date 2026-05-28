'use client'

import { getApp } from 'firebase/app'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import { useEffect } from 'react'

export function useFcmToken() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    let cleanup: (() => void) | undefined

    async function register() {
      const supported = await isSupported()
      if (!supported) return

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const app = getApp()
      const messaging = getMessaging(app)

      const swReg = await navigator.serviceWorker.register(
        '/api/firebase-messaging-sw.js',
        { scope: '/' },
      )

      const token = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: swReg,
      })

      if (!token) return

      await setDoc(
        doc(firestore, 'users', user!.uid, 'fcmTokens', token),
        {
          token,
          platform: 'web',
          app: 'entregador',
          lastUsedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        },
        { merge: true },
      )

      cleanup = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification ?? {}
        if (title && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/icon-192.png' })
        }
      })
    }

    register().catch((err) => console.error('useFcmToken:', err))

    return () => cleanup?.()
  }, [user?.uid])
}
