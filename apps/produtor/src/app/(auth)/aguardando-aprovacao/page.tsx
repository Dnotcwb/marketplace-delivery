import { type Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Aguardando Aprovação',
}

export default function AguardandoAprovacaoPage() {
  return (
    <div className="w-full max-w-md text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-warning/10">
          <svg className="h-10 w-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <h1 className="mb-2 text-2xl font-bold text-neutral-900">
        Cadastro em análise
      </h1>
      <p className="mb-6 text-neutral-500">
        Recebemos seu cadastro e estamos analisando as informações da sua horta.
        Você receberá um e-mail assim que a aprovação for concluída.
      </p>

      <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-4 text-left">
        <h2 className="mb-3 text-sm font-semibold text-neutral-700">O que acontece agora?</h2>
        <ol className="space-y-2 text-sm text-neutral-500">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">1</span>
            Nossa equipe revisa seus dados em até 48 horas úteis.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">2</span>
            Você recebe um e-mail de confirmação com as instruções de acesso.
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">3</span>
            Configure sua horta e comece a receber pedidos.
          </li>
        </ol>
      </div>

      <Link
        href="/login"
        className="text-sm font-medium text-brand-500 hover:underline"
      >
        Voltar para o login
      </Link>
    </div>
  )
}
