import Link from 'next/link'

export default function AcessoNegadoPage() {
  return (
    <div className="w-full max-w-sm text-center">
      <div className="mb-4 text-5xl" aria-hidden="true">🚫</div>
      <h1 className="mb-2 text-2xl font-bold text-neutral-900">Acesso negado</h1>
      <p className="mb-6 text-neutral-500">
        Você não tem permissão para acessar esta área.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-brand-500 px-6 py-2 font-medium text-white hover:bg-brand-600"
      >
        Ir para o login
      </Link>
    </div>
  )
}
