import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/cadastro', '/recuperar-senha', '/aguardando-aprovacao', '/acesso-negado']

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = request.cookies.get('__session')?.value

  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
