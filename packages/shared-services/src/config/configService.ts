import { doc, getDoc } from 'firebase/firestore'
import { firestore } from '@marketplace/shared-firebase'

export interface PlatformConfig {
  /**
   * Modo demonstração: quando true, o marketplace opera sem pagamento real —
   * produtores vendem sem conta Stripe conectada e os pedidos são confirmados
   * automaticamente. Usado na fase de validação com dados fictícios.
   * Em produção deve ficar false (ou ausente).
   */
  demoMode: boolean
}

/**
 * Lê a configuração global da plataforma (appConfig/platform).
 * Retorna valores padrão seguros quando o documento ou o campo não existem.
 */
export async function getPlatformConfig(): Promise<PlatformConfig> {
  try {
    const snap = await getDoc(doc(firestore, 'appConfig', 'platform'))
    const data = snap.exists() ? snap.data() : {}
    return { demoMode: data['demoMode'] === true }
  } catch {
    // Falha ao ler config nunca deve quebrar a página — assume produção (seguro).
    return { demoMode: false }
  }
}
