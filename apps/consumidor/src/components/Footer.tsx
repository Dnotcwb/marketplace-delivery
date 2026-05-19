import Link from 'next/link'

const ANO = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden="true">🍔</span>
            <span className="font-semibold text-neutral-700">Delivery</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-500">
            <Link href="/sobre" className="hover:text-neutral-900">Sobre</Link>
            <Link href="/termos" className="hover:text-neutral-900">Termos de Uso</Link>
            <Link href="/privacidade" className="hover:text-neutral-900">Privacidade</Link>
          </nav>
          <p className="text-xs text-neutral-400">
            © {ANO} Delivery. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}
