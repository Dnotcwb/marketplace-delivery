'use client'

import {
  listProdutoresByOwner,
  subscribeToProdutorById,
  useAuth,
} from '@marketplace/shared-services'
import type { Produtor } from '@marketplace/shared-types'
import { useEffect, useState } from 'react'

/**
 * Retorna o produtor ativo do usuário logado.
 * Se aprovado (produtorIds nas claims), usa listener real-time.
 * Se pendente, busca por ownerUid uma única vez.
 */
export function useProdutorAtivo() {
  const { user, claims } = useAuth()
  const [produtor, setProdutor] = useState<Produtor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setProdutor(null)
      setLoading(false)
      return
    }

    const ids = claims?.produtorIds
    if (ids && ids.length > 0) {
      const id = ids[0]!
      const unsub = subscribeToProdutorById(id, (p) => {
        setProdutor(p)
        setLoading(false)
      })
      return unsub
    }

    // Sem produtorIds — pode ser pendente ou ainda não configurado
    listProdutoresByOwner(user.uid)
      .then((list) => {
        setProdutor(list[0] ?? null)
      })
      .finally(() => setLoading(false))
  }, [user, claims])

  return { produtor, loading }
}
