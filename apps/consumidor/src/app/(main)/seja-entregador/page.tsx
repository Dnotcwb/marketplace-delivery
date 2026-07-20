import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Seja entregador',
  description:
    'Faça entregas com o Brota, com flexibilidade de horários e ganhos por corrida na sua região.',
}

const ENTREGADOR_URL = 'https://entregador.brotadigital.com.br/cadastro'

const BENEFICIOS = [
  { icon: '🕒', title: 'Flexibilidade total', text: 'Você decide os dias e horários que quer trabalhar.' },
  { icon: '📍', title: 'Entregas por perto', text: 'Corridas na sua região, com trajetos curtos.' },
  { icon: '💵', title: 'Ganhos transparentes', text: 'Acompanhe o valor de cada entrega e o total por período.' },
  { icon: '📱', title: 'App simples', text: 'Aceite, entregue e confirme em poucos toques.' },
]

export default function SejaEntregadorPage() {
  return (
    <ContentPage
      eyebrow="Para entregadores"
      title="Seja um entregador Brota"
      subtitle="Ganhe por entrega, no seu tempo, perto de casa."
    >
      <p>
        Com o Brota, você faz entregas de alimentos frescos na sua região com flexibilidade para
        escolher quando trabalhar. Receba as corridas disponíveis pelo app, aceite as que fizerem
        sentido para você e acompanhe seus ganhos em tempo real.
      </p>

      <h2>Vantagens de entregar com o Brota</h2>
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
        <p className="text-lg font-bold">Quer começar a entregar?</p>
        <p className="text-sm text-white/80">O cadastro é gratuito e rápido.</p>
        <a
          href={ENTREGADOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 rounded-xl bg-white px-6 py-3 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Quero ser entregador →
        </a>
      </div>
    </ContentPage>
  )
}
