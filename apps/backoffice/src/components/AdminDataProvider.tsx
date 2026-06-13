'use client'

import {
  subscribeToAllOrders,
  subscribeToAllPedidosFilhos,
  subscribeToAllProdutores,
} from '@marketplace/shared-services'
import type { Order, PedidoFilho, Produtor } from '@marketplace/shared-types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

interface AdminDataValue {
  orders: Order[]
  produtores: Produtor[]
  pedidosFilhos: PedidoFilho[]
  /** true até orders + produtores carregarem pela primeira vez */
  loading: boolean
  /** true até os pedidos filhos carregarem pela primeira vez */
  filhosLoading: boolean
  /** mensagem de erro da subscription de pedidos (ex: permissão), se houver */
  ordersError: string | null
}

const AdminDataContext = createContext<AdminDataValue | null>(null)

/**
 * Mantém as assinaturas pesadas do admin (pedidos, produtores, pedidos filhos)
 * vivas no nível do layout. Como o provider fica montado durante toda a sessão
 * do dashboard, navegar entre Dashboard / Pedidos / Financeiro / Relatórios /
 * Produtores reaproveita os mesmos dados — sem re-assinar nem re-renderizar
 * spinner a cada troca de tela.
 */
export function AdminDataProvider({ children }: { children: React.ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [produtores, setProdutores] = useState<Produtor[]>([])
  const [pedidosFilhos, setPedidosFilhos] = useState<PedidoFilho[]>([])
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [produtoresLoaded, setProdutoresLoaded] = useState(false)
  const [filhosLoaded, setFilhosLoaded] = useState(false)
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
    const unsubFilhos = subscribeToAllPedidosFilhos((list) => {
      setPedidosFilhos(list)
      setFilhosLoaded(true)
    })
    return () => {
      unsubOrders()
      unsubProd()
      unsubFilhos()
    }
  }, [])

  const value = useMemo<AdminDataValue>(
    () => ({
      orders,
      produtores,
      pedidosFilhos,
      loading: !(ordersLoaded && produtoresLoaded),
      filhosLoading: !filhosLoaded,
      ordersError,
    }),
    [orders, produtores, pedidosFilhos, ordersLoaded, produtoresLoaded, filhosLoaded, ordersError],
  )

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
}

export function useAdminData(): AdminDataValue {
  const ctx = useContext(AdminDataContext)
  if (!ctx) throw new Error('useAdminData deve ser usado dentro de <AdminDataProvider>')
  return ctx
}
