import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Sobre nós',
  description:
    'O Brota conecta pequenos produtores locais direto ao seu consumidor, com alimento fresco, preço justo e circuito curto.',
}

const VALORES = [
  {
    icon: '🌾',
    title: 'Circuito curto',
    text: 'Menos intermediários, mais frescor e preço justo dos dois lados.',
  },
  {
    icon: '🏡',
    title: 'Economia local',
    text: 'O dinheiro circula na sua cidade e fortalece quem produz por perto.',
  },
  {
    icon: '🔎',
    title: 'Transparência',
    text: 'Você sabe de qual produtor veio cada item, com certificações à vista.',
  },
  {
    icon: '🌱',
    title: 'Sustentabilidade',
    text: 'Valorizamos a produção agroecológica e a redução do desperdício.',
  },
]

export default function SobrePage() {
  return (
    <ContentPage
      eyebrow="Institucional"
      title="Sobre o Brota"
      subtitle="Do produtor à sua mesa, sem atravessador."
    >
      <p>
        O <strong>Brota</strong> nasceu de uma ideia simples: aproximar quem planta de quem
        consome. Pequenos produtores, hortas urbanas e agricultores familiares têm alimento
        fresco e de qualidade para oferecer — mas enfrentam barreiras para vender direto ao
        consumidor. De outro lado, cada vez mais pessoas querem comer melhor, saber de onde vem
        a comida e apoiar a economia da própria cidade.
      </p>
      <p>
        Nós conectamos os dois lados em uma plataforma de delivery pensada para o alimento local:
        o consumidor monta um pedido — inclusive com itens de vários produtores de uma mesma
        horta — paga uma vez e recebe em casa. Cada produtor recebe automaticamente a sua parte,
        com uma comissão justa e transparente.
      </p>

      <h2>O que nos move</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {VALORES.map((v) => (
          <div
            key={v.title}
            className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl">
              {v.icon}
            </div>
            <p className="text-base font-bold text-neutral-900">{v.title}</p>
            <p className="mt-1 text-sm text-neutral-500">{v.text}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-4 flex flex-col items-start gap-4 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-bold">Quer fazer parte?</p>
          <p className="text-sm text-white/80">Venda ou entregue com o Brota e cresça com a gente.</p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Link
            href="/seja-produtor"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Seja produtor
          </Link>
          <Link
            href="/seja-entregador"
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition-colors hover:bg-brand-50"
          >
            Seja entregador
          </Link>
        </div>
      </div>
    </ContentPage>
  )
}
