import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Termos de uso',
  description: 'Termos e condições de uso da plataforma Brota.',
}

export default function TermosPage() {
  return (
    <ContentPage eyebrow="Legal" title="Termos de uso" subtitle="Última atualização: julho de 2026">
      <p>
        Ao acessar e utilizar a plataforma Brota, você concorda com os termos e condições
        descritos abaixo. Leia com atenção. Caso não concorde, pedimos que não utilize os nossos
        serviços.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">1. Sobre a plataforma</h2>
      <p>
        O Brota é um marketplace que conecta produtores locais a consumidores, intermediando
        pedidos, pagamentos e entregas. Não somos os fabricantes dos produtos anunciados: a
        responsabilidade pela qualidade e descrição dos itens é de cada produtor.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">2. Cadastro e conta</h2>
      <p>
        Para realizar pedidos, você deve criar uma conta com informações verdadeiras e mantê-las
        atualizadas. Você é responsável por preservar a confidencialidade das suas credenciais e
        por toda atividade realizada na sua conta.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">3. Pedidos e pagamentos</h2>
      <p>
        Os preços e a disponibilidade dos produtos são definidos pelos produtores e podem mudar.
        O pagamento é processado por parceiros especializados, em ambiente seguro. A confirmação
        do pedido ocorre após a aprovação do pagamento.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">4. Cancelamento e estorno</h2>
      <p>
        Pedidos podem ser cancelados enquanto ainda não estiverem em preparo. Havendo pagamento
        aprovado, o estorno é processado conforme as regras do meio de pagamento utilizado.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">5. Conduta do usuário</h2>
      <p>
        Você concorda em utilizar a plataforma de forma lícita, sem prejudicar seu funcionamento,
        outros usuários ou os produtores parceiros.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">6. Alterações destes termos</h2>
      <p>
        Podemos atualizar estes termos periodicamente. Mudanças relevantes serão comunicadas
        pelos nossos canais. O uso continuado da plataforma após a atualização representa a sua
        concordância.
      </p>

      <p className="pt-2 text-neutral-500">
        Dúvidas sobre estes termos? Escreva para{' '}
        <a href="mailto:suporte@brota.com.br" className="font-semibold text-brand-600 hover:underline">
          suporte@brota.com.br
        </a>
        .
      </p>
    </ContentPage>
  )
}
