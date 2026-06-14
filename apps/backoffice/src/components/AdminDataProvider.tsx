'use client'

import {
  subscribeToAllOrders,
  subscribeToAllProdutores,
} from '@marketplace/shared-services'
import type { Order, Produtor } from '@marketplace/shared-types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

interface AdminDataValue {
  orders: Order[]
  produtores: Produtor[]
  /** true até orders + produtores carregarem pela primeira vez */
  loading: boolean
  /** mensagem de erro da subscription de pedidos (ex: permissão), se houver */
  ordersError: string | null
}

const AdminDataContext = createContext<AdminDataValue | null>(null)

/**
 * Mantém as assinaturas compartilhadas do admin (pedidos + produtores) vivas no
 * nível do layout. Como o provider fica montado durante toda a sessão do
 * dashboard, navegar entre Dashboard / Pedidos / Relatórios / Produtores
 * reaproveita os mesmos dados — sem re-assinar nem mostrar spinner a cada troca.
 *
 * `pedidos_filhos` NÃO entra aqui de propósito: só o Financeiro usa, é uma
 * coleção grande, e baixá-la no acesso ao Dashboard tornava a entrada lenta.
 * O Financeiro assina por conta própria quando é aberto.
 */
export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [produtoresLoaded, setProdutoresLoaded] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  useEffect(() => {
    const unsubOrders = subscribeToAllOrders(
      (list) => {
        setOrders(list)
        setOrdersLoaded(true)
        setOrdersError(null)
      },
      (err) => {
        const code = (err as { code?: string }).code ?? ''
        setOrdersError(
          code === 'permission-denied'
            ? 'Sem permissão para listar pedidos. Verifique se seu token está atualizado e recarregue.'
            : `Erro na subscription de pedidos (${code || err.message}). Recarregue a página.`,
        )
        setOrdersLoaded(true)
      },
    )
    const unsubProd = subscribeToAllProdutores((list) => {
      setProdutores(list)
      setProdutoresLoaded(true)
    })
    return () => {
      unsubOrders()
      unsubProd()
    }
  }, [])

  const value = useMemo<AdminDataValue>(
    () => ({
      orders,
      produtores,
      loading: !(ordersLoaded && produtoresLoaded),
      ordersError,
    }),
    [orders, produtores, ordersLoaded, produtoresLoaded, ordersError],
  )

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

export function useAdminData(): AdminDataValue {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminData deve ser usado dentro de <AdminDataProvider>')
  return ctx
}
