import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Parceiros',
  description:
    'Cooperativas, associações de produtores e marcas que acreditam no alimento local podem crescer com o Brota.',
}

export default function ParceirosPage() {
  return (
    <ContentPage
      eyebrow="Parcerias"
      title="Parceiros"
      subtitle="Vamos crescer juntos, fortalecendo a produção local."
    >
      <p>
        O Brota acredita que ninguém constrói uma rede de alimento local sozinho. Por isso,
        trabalhamos lado a lado com quem já está no território: cooperativas, associações de
        produtores, feiras, iniciativas de agricultura urbana e marcas comprometidas com uma
        cadeia mais justa e sustentável.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">Quem pode ser parceiro</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Cooperativas e associações</strong> que queiram levar seus produtores para o digital.</li>
        <li><strong>Hortas comunitárias e urbanas</strong> em busca de novos canais de venda.</li>
        <li><strong>Poder público e instituições</strong> com programas de agricultura familiar e segurança alimentar.</li>
        <li><strong>Marcas e empresas</strong> alinhadas ao consumo consciente e ao impacto local.</li>
      </ul>

      <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-5">
        <p className="font-semibold text-neutral-800">Quer conversar sobre uma parceria?</p>
        <p className="mt-1">
          Escreva para{' '}
          <a href="mailto:parcerias@brota.com.br" className="font-semibold text-brand-600 hover:underline">
            parcerias@brota.com.br
          </a>{' '}
          contando um pouco sobre a sua organização. Vamos adorar entender como podemos crescer
          juntos.
        </p>
      </div>

      <p className="pt-1">
        É produtor e quer vender pelo Brota?{' '}
        <Link href="/seja-produtor" className="font-semibold text-brand-600 hover:underline">
          Comece por aqui
        </Link>
        .
      </p>
    </ContentPage>
  )
}
