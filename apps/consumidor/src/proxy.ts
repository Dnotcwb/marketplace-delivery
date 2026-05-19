import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/cadastro',
  '/recuperar-senha',
  '/acesso-negado',
  '/produtor',
  '/busca',
  '/categorias',
  '/categoria',
  '/termos',
  '/privacidade',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  )
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const session = request.cookies.get('__session')?.value

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
