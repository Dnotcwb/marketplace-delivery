import { type NextRequest, NextResponse } from 'next/server'

// O Firebase SDK armazena auth em IndexedDB (client-side), não em cookies.
// Por isso não é possível verificar autenticação aqui no edge.
// A proteção de rotas é feita pelo ProdutorGuard (client component) e
// pelo AuthGuard no layout de setup — ambos usam onAuthStateChanged.
export default function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
