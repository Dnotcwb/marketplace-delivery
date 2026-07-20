import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@marketplace/shared-firebase'
import { DEFAULT_MIN_ORDER_IN_CENTS, DEFAULT_DRIVER_SHARE_PCT } from '@marketplace/shared-utils'

export interface PlatformConfig {
  /**
   * Modo demonstração: quando true, o marketplace opera sem pagamento real —
   * produtores vendem sem conta Stripe conectada e os pedidos são confirmados
   * automaticamente. Usado na fase de validação com dados fictícios.
   * Em produção deve ficar false (ou ausente).
   */
  demoMode: boolean
  /** Piso de pedido em toda a plataforma (centavos). Abaixo disso o checkout é bloqueado. */
  minOrderValueInCents: number
  /** Fatia da taxa de entrega que fica com o entregador (0-100). O restante é da plataforma. */
  deliveryDriverSharePct: number
}

/**
 * Lê a configuração global da plataforma (appConfig/platform).
 * Retorna valores padrão seguros quando o documento ou o campo não existem.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  try {
    const snap = await getDoc(doc(firestore, 'appConfig', 'platform'))
    const data = snap.exists() ? snap.data() : {}
    return {
      demoMode: data['demoMode'] === true,
      minOrderValueInCents:
        typeof data['minOrderValueInCents'] === 'number'
          ? data['minOrderValueInCents']
          : DEFAULT_MIN_ORDER_IN_CENTS,
      deliveryDriverSharePct:
        typeof data['deliveryDriverSharePct'] === 'number'
          ? data['deliveryDriverSharePct']
          : DEFAULT_DRIVER_SHARE_PCT,
    }
  } catch {
    // Falha ao ler config nunca deve quebrar a página — assume produção (seguro).
    return {
      demoMode: false,
      minOrderValueInCents: DEFAULT_MIN_ORDER_IN_CENTS,
      deliveryDriverSharePct: DEFAULT_DRIVER_SHARE_PCT,
    }
  }
}
