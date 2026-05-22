import { type NextRequest, NextResponse } from 'next/server'

// API route server-side para geocodificação de CEP.
// Roda no servidor → User-Agent correto, sem CORS.
export async function GET(request: NextRequest) {
  const cep = request.nextUrl.searchParams.get('cep')
  if (!cep) return NextResponse.json(null, { status: 400 })

  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return NextResponse.json(null, { status: 400 })

  const headers = { 'User-Agent': 'marketplace-delivery/1.0 contact@example.com' }

  // Tentativa 1: Nominatim por CEP
  try {
    const r1 = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${digits}&country=BR&format=json&limit=1`,
      { headers, next: { revalidate: 3600 } },
    )
    if (r1.ok) {
      const d1 = (await r1.json()) as Array<{ lat: string; lon: string }>
      if (d1.length > 0) {
        return NextResponse.json(
          { lat: parseFloat(d1[0]!.lat), lng: parseFloat(d1[0]!.lon) },
          { headers: { 'Cache-Control': 'public, max-age=3600' } },
        )
      }
    }
  } catch { /* fallback */ }

  // Tentativa 2: ViaCEP → cidade/UF → Nominatim por texto livre
  try {
    const rCep = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!rCep.ok) return NextResponse.json(null)
    const cepData = (await rCep.json()) as { erro?: boolean; localidade?: string; uf?: string }
    if (cepData.erro || !cepData.localidade || !cepData.uf) return NextResponse.json(null)

    const q = encodeURIComponent(`${cepData.localidade}, ${cepData.uf}, Brasil`)
    const r2 = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      { headers, next: { revalidate: 3600 } },
    )
    if (!r2.ok) return NextResponse.json(null)
    const d2 = (await r2.json()) as Array<{ lat: string; lon: string }>
    if (!d2.length) return NextResponse.json(null)
    return NextResponse.json(
      { lat: parseFloat(d2[0]!.lat), lng: parseFloat(d2[0]!.lon) },
      { headers: { 'Cache-Control': 'public, max-age=3600' } },
    )
  } catch {
    return NextResponse.json(null)
  }
}
