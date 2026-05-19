import Link from 'next/link'

export default function AcessoNegadoPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="text-center">
        <div className="mb-4 text-5xl">🚫</div>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900">Acesso negado</h1>
        <p className="mb-6 text-neutral-500">Você não tem permissão para acessar esta página.</p>
        <Link
          href="/"
          className="rounded-lg bg-brand-500 px-6 py-2 font-medium text-white hover:bg-brand-600"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  )
}
