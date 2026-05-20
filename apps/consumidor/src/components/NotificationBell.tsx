'use client'

import { firestore } from '@marketplace/shared-firebase'
import { useAuth } from '@marketplace/shared-services'
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface Notif {
  id: string
  orderId: string
  status: string
  produtorName: string
  message: string
  read: boolean
  createdAt: unknown
}

const STATUS_ICON: Record<string, string> = {
  confirmed:   '✅',
  accepted:    '👍',
  preparing:   '🍳',
  ready:       '📦',
  on_delivery: '🛵',
  delivered:   '🥦',
  cancelled:   '❌',
  refunded:    '↩️',
}

function timeAgo(ts: unknown): string {
  if (!ts || typeof (ts as { toDate?: unknown }).toDate !== 'function') return ''
  try {
    const d = (ts as Timestamp).toDate()
    const mins = Math.floor((Date.now() - d.getTime()) / 60000)
    if (mins < 1) return 'agora'
    if (mins < 60) return `${mins}min`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    return `${Math.floor(mins / 1440)}d`
  } catch { return '' }
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) { setNotifs([]); return }

    const q = query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20),
    )

    const unsub = onSnapshot(q, (snap) => {
      setNotifs(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notif))
    }, (err) => {
      console.error('notifications onSnapshot error:', err.code)
    })

    return unsub
  }, [user])

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) return null

  const unread = notifs.filter((n) => !n.read).length

  async function markRead(n: Notif) {
    if (n.read) return
    try {
      await updateDoc(
        doc(firestore, 'users', user!.uid, 'notifications', n.id),
        { read: true },
      )
    } catch (err) {
      console.error('markRead error:', err)
    }
  }

  async function markAllRead() {
    const items = notifs.filter((n) => !n.read)
    if (!items.length) return
    const batch = writeBatch(firestore)
    items.forEach((n) =>
      batch.update(
        doc(firestore, 'users', user!.uid, 'notifications', n.id),
        { read: true },
      ),
    )
    try { await batch.commit() } catch (err) { console.error('markAllRead error:', err) }
  }

  return (
    <div className="relative" ref={dropRef}>
      {/* Botão sino */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notificações${unread > 0 ? ` — ${unread} não lidas` : ''}`}
        className="relative rounded-full p-2 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-brand-600"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl z-50">
          {/* Cabeçalho */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <span className="text-sm font-bold text-neutral-900">Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-500 hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
            {notifs.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">Sem notificações</p>
            ) : (
              notifs.map((n) => (
                <Link
                  key={n.id}
                  href={`/pedido/${n.orderId}`}
                  onClick={() => { void markRead(n); setOpen(false) }}
                  className={[
                    'flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-neutral-50',
                    !n.read ? 'bg-blue-50/50' : '',
                  ].join(' ')}
                >
                  <span className="mt-0.5 text-base shrink-0">{STATUS_ICON[n.status] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={['leading-snug text-neutral-700', !n.read ? 'font-medium' : ''].join(' ')}>
                      {n.message}
                    </p>
                    {n.produtorName && (
                      <p className="mt-0.5 truncate text-xs text-neutral-400">{n.produtorName}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-neutral-400">{timeAgo(n.createdAt)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
