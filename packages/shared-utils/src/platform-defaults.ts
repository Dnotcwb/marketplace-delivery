/**
 * Valores padrão de parâmetros econômicos da plataforma.
 *
 * São os fallbacks usados quando `appConfig/platform` ainda não define o campo.
 * O admin pode sobrescrevê-los no backoffice; estes garantem comportamento
 * consistente mesmo sem configuração e servem de fonte única da verdade para
 * cálculos no cliente e nas Cloud Functions.
 */

/** Piso de pedido em toda a plataforma. Abaixo disso o checkout é bloqueado. */
export const DEFAULT_MIN_ORDER_IN_CENTS = 3000

/**
 * Fatia da taxa de entrega que fica com o entregador (o restante é a taxa de
 * intermediação da plataforma). 75 = entregador 75%, plataforma 25%.
 */
export const DEFAULT_DRIVER_SHARE_PCT = 75

/** Valor mínimo de pedido efetivo: o maior entre o piso da plataforma e o da horta. */
export function effectiveMinOrderInCents(
  hortaMinInCents: number | undefined | null,
  platformMinInCents: number | undefined | null,
): number {
  return Math.max(hortaMinInCents ?? 0, platformMinInCents ?? DEFAULT_MIN_ORDER_IN_CENTS)
}

/** Divide a taxa de entrega entre entregador e plataforma segundo a fatia configurada. */
export function splitDeliveryFee(
  deliveryFeeInCents: number,
  driverSharePct: number = DEFAULT_DRIVER_SHARE_PCT,
): { driverPayoutInCents: number; platformDeliveryFeeInCents: number } {
  const pct = Number.isFinite(driverSharePct) ? driverSharePct : DEFAULT_DRIVER_SHARE_PCT
  const driverPayoutInCents = Math.round(deliveryFeeInCents * (pct / 100))
  return {
    driverPayoutInCents,
    platformDeliveryFeeInCents: deliveryFeeInCents - driverPayoutInCents,
  }
}

/**
 * Quanto o entregador efetivamente recebe por um pedido.
 * Usa o valor gravado no pedido; se ausente (pedido antigo), deriva do padrão.
 */
export function driverPayoutOf(order: {
  driverPayoutInCents?: number
  deliveryFeeInCents: number
}): number {
  return order.driverPayoutInCents ?? splitDeliveryFee(order.deliveryFeeInCents).driverPayoutInCents
}
