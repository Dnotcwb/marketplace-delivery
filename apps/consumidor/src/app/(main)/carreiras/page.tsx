import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Carreiras',
  description: 'Venha construir com a gente uma nova forma de conectar produtores e consumidores.',
}

export default function CarreirasPage() {
  return (
    <ContentPage
      eyebrow="Trabalhe conosco"
      title="Carreiras"
      subtitle="Construa com a gente o futuro do alimento local."
    >
      <p>
        Somos uma startup em crescimento, com a missão de fortalecer a produção local e levar
        alimento fresco a mais mesas. Buscamos pessoas curiosas, mão na massa e que se importam
        com impacto real — em tecnologia, operações, relacionamento com produtores e experiência
        do cliente.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">Como trabalhamos</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Autonomia com responsabilidade e foco no cliente.</li>
        <li>Times pequenos, decisões rápidas e aprendizado constante.</li>
        <li>Propósito claro: cada entrega apoia um pequeno produtor.</li>
      </ul>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="font-semibold text-neutral-800">Não há vagas abertas no momento.</p>
        <p className="mt-1">
          Mas adoramos conhecer gente boa antes mesmo de precisar. Envie seu currículo e uma
          breve apresentação para{' '}
          <a href="mailto:carreiras@brota.com.br" className="font-semibold text-brand-600 hover:underline">
            carreiras@brota.com.br
          </a>{' '}
          — entramos em contato quando surgir uma oportunidade com o seu perfil.
        </p>
      </div>
    </ContentPage>
  )
}
