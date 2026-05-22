/** Distância em km entre dois pontos via fórmula de Haversine. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface DeliveryFeeConfig {
  deliveryFeeInCents: number
  /** 0 ou ausente = taxa fixa */
  deliveryFeePerKmInCents?: number
  /** 0 ou ausente = ilimitado */
  deliveryRadiusKm?: number | null
  lat?: number
  lng?: number
}

export interface DeliveryFeeResult {
  feeInCents: number
  distanceKm?: number
  /** true quando o endereço está fora do raio configurado */
  outOfRange?: boolean
}

/**
 * Calcula a taxa de entrega para o cliente.
 * Sem coordenadas → devolve a taxa fixa sem distance.
 */
export function calcDeliveryFee(
  config: DeliveryFeeConfig,
  customerLat?: number,
  customerLng?: number,
): DeliveryFeeResult {
  const { deliveryFeeInCents, deliveryFeePerKmInCents, deliveryRadiusKm, lat, lng } = config

  if (!lat || !lng || !customerLat || !customerLng) {
    return { feeInCents: deliveryFeeInCents }
  }

  const distanceKm = haversineKm(lat, lng, customerLat, customerLng)

  if (deliveryRadiusKm && deliveryRadiusKm > 0 && distanceKm > deliveryRadiusKm) {
    return { feeInCents: deliveryFeeInCents, distanceKm, outOfRange: true }
  }

  if (deliveryFeePerKmInCents && deliveryFeePerKmInCents > 0) {
    const dynamic = Math.round(distanceKm * deliveryFeePerKmInCents)
    return { feeInCents: Math.max(deliveryFeeInCents, dynamic), distanceKm }
  }

  return { feeInCents: deliveryFeeInCents, distanceKm }
}

/**
 * Geocodifica um CEP brasileiro em coordenadas.
 * Estratégia: Nominatim por CEP → fallback Nominatim por cidade/UF (via ViaCEP).
 * Retorna null se ambas as tentativas falharem.
 */
export async function geocodeCep(cep: string): Promise<{ lat: number; lng: number } | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null

  const headers = { 'User-Agent': 'marketplace-delivery/1.0 contact@example.com' }

  try {
    // Tentativa 1: Nominatim por CEP
    const r1 = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`,
      { headers },
    )
    if (r1.ok) {
      const d1 = (await r1.json()) as Array<{ lat: string; lon: string }>
      if (d1.length > 0) {
        return { lat: parseFloat(d1[0]!.lat), lng: parseFloat(d1[0]!.lon) }
      }
    }
  } catch { /* continua para o fallback */ }

  try {
    // Tentativa 2: ViaCEP → cidade/UF → Nominatim por cidade
    const rCep = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!rCep.ok) return null
    const cepData = (await rCep.json()) as { erro?: boolean; localidade?: string; uf?: string }
    if (cepData.erro || !cepData.localidade || !cepData.uf) return null

    const city  = encodeURIComponent(cepData.localidade)
    const state = encodeURIComponent(cepData.uf)
    const r2 = await fetch(
      `https://nominatim.openstreetmap.org/search?city=${city}&state=${state}&country=BR&format=json&limit=1`,
      { headers },
    )
    if (!r2.ok) return null
    const d2 = (await r2.json()) as Array<{ lat: string; lon: string }>
    if (!d2.length) return null
    return { lat: parseFloat(d2[0]!.lat), lng: parseFloat(d2[0]!.lon) }
  } catch {
    return null
  }
}
