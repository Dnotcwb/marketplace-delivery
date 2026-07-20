import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Seja produtor',
  description:
    'Venda seus produtos frescos direto ao consumidor pelo Brota, com comissão justa e recebimento automático.',
}

const PRODUTOR_URL = 'https://produtor.brotadigital.com.br/cadastro'

const BENEFICIOS = [
  { icon: '💰', title: 'Comissão justa', text: 'Transparente e menor que a dos grandes aplicativos.' },
  { icon: '⚡', title: 'Recebimento automático', text: 'A sua parte de cada pedido cai direto na sua conta.' },
  { icon: '🔔', title: 'Pedidos em tempo real', text: 'Com alerta sonoro e impressão de comanda.' },
  { icon: '🥬', title: 'Sua vitrine digital', text: 'Mostre suas certificações e conquiste novos clientes.' },
]

export default function SejaProdutorPage() {
  return (
    <ContentPage
      eyebrow="Para produtores"
      title="Seja um produtor Brota"
      subtitle="Venda direto ao consumidor, sem atravessador."
    >
      <p>
        Se você produz alimentos — de hortaliças a ovos, mel, geleias e muito mais — o Brota é o
        seu canal para vender direto a quem valoriza o que é fresco e local. Você monta o seu
        catálogo, recebe pedidos em tempo real e acompanha tudo pelo app do produtor.
      </p>

      <h2>Por que vender no Brota</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {BENEFICIOS.map((b) => (
          <div
            key={b.title}
            className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">
              {b.icon}
            </div>
            <div>
              <p className="font-bold text-neutral-900">{b.title}</p>
              <p className="mt-0.5 text-sm text-neutral-500">{b.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-6 text-white">
        <p className="text-lg font-bold">Pronto para começar?</p>
        <p className="text-sm text-white/80">O cadastro é gratuito e leva poucos minutos.</p>
        <a
          href={PRODUTOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Quero ser produtor →
        </a>
      </div>
    </ContentPage>
  )
}
