import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como o Brota coleta, usa e protege os seus dados pessoais.',
}

export default function PrivacidadePage() {
  return (
    <ContentPage eyebrow="Legal" title="Política de Privacidade" subtitle="Última atualização: julho de 2026">
      <p>
        A sua privacidade é importante para nós. Esta política explica quais dados o Brota coleta,
        como os utilizamos e quais são os seus direitos, em conformidade com a Lei Geral de
        Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">1. Dados que coletamos</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>Cadastrais:</strong> nome, e-mail, telefone e senha.</li>
        <li><strong>De entrega:</strong> endereços informados para receber os pedidos.</li>
        <li><strong>De pedidos:</strong> histórico de compras e itens adquiridos.</li>
        <li><strong>De pagamento:</strong> processados por parceiros seguros — não armazenamos os dados do seu cartão.</li>
      </ul>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">2. Como usamos os seus dados</h2>
      <p>
        Utilizamos as suas informações para processar pedidos, viabilizar a entrega, oferecer
        suporte, melhorar a plataforma e comunicar novidades relevantes. Não vendemos os seus
        dados pessoais.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">3. Compartilhamento</h2>
      <p>
        Compartilhamos apenas o necessário para a operação do serviço — por exemplo, dados de
        entrega com o produtor e o entregador responsáveis pelo seu pedido, e dados de pagamento
        com o processador financeiro. Todos são obrigados a proteger essas informações.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">4. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger os seus dados contra acesso não
        autorizado, perda ou alteração indevida.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">5. Os seus direitos</h2>
      <p>
        Você pode acessar, corrigir ou solicitar a exclusão dos seus dados, além de revogar
        consentimentos, a qualquer momento. Boa parte dessas ações está disponível na página do
        seu perfil; para as demais, fale com a gente.
      </p>

      <h2 className="pt-2 text-lg font-bold text-neutral-900">6. Contato</h2>
      <p>
        Para exercer os seus direitos ou tirar dúvidas sobre privacidade, escreva para{' '}
        <a href="mailto:privacidade@brota.com.br" className="font-semibold text-brand-600 hover:underline">
          privacidade@brota.com.br
        </a>
        .
      </p>
    </ContentPage>
  )
}
