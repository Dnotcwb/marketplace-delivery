import Link from 'next/link'
import Logo from './Logo'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">

          {/* Marca */}
          <div className="flex flex-col gap-3">
            <Logo variant="full" size={38} />
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Conectando você aos melhores sabores da sua cidade com entrega rápida e segura.
            </p>
          </div>

          {/* Links */}
          <nav
            className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-3"
            aria-label="Links do rodapé"
          >
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-neutral-900">Empresa</span>
              <Link href="/sobre" className="text-neutral-500 transition-colors hover:text-brand-600">Sobre nós</Link>
              <Link href="/carreiras" className="text-neutral-500 transition-colors hover:text-brand-600">Carreiras</Link>
              <Link href="/blog" className="text-neutral-500 transition-colors hover:text-brand-600">Blog</Link>
              <Link href="/parceiros" className="text-neutral-500 transition-colors hover:text-brand-600">Parceiros</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-neutral-900">Junte-se a nós</span>
              <Link href="/seja-produtor" className="text-neutral-500 transition-colors hover:text-brand-600">Seja produtor</Link>
              <Link href="/seja-entregador" className="text-neutral-500 transition-colors hover:text-brand-600">Seja entregador</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-neutral-900">Suporte</span>
              <Link href="/ajuda" className="text-neutral-500 transition-colors hover:text-brand-600">Central de ajuda</Link>
              <Link href="/termos" className="text-neutral-500 transition-colors hover:text-brand-600">Termos de uso</Link>
              <Link href="/privacidade" className="text-neutral-500 transition-colors hover:text-brand-600">Privacidade</Link>
            </div>
          </nav>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-neutral-100 pt-6 text-xs text-neutral-400 sm:flex-row">
          <span>© {year} Brota. Todos os direitos reservados.</span>
          <span>Feito com cuidado para conectar sabores</span>
        </div>
      </div>
    </footer>
  )
}
