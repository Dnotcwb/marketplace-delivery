import type { Metadata } from 'next'
import Link from 'next/link'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Central de ajuda',
  description: 'Dúvidas frequentes sobre pedidos, pagamento, entrega e sua conta no Brota.',
}

const FAQ = [
  {
    q: 'Como faço um pedido?',
    a: 'Escolha uma horta ou produtor, adicione os produtos ao carrinho e finalize no checkout informando seu endereço e a forma de pagamento. Você acompanha o status do pedido em tempo real.',
  },
  {
    q: 'Posso comprar de vários produtores no mesmo pedido?',
    a: 'Sim! Dentro de uma mesma horta, você pode montar um pedido com itens de diferentes produtores e pagar tudo de uma vez.',
  },
  {
    q: 'Quais formas de pagamento são aceitas?',
    a: 'Você paga com PIX ou cartão de crédito em uma página de pagamento segura. O valor é processado com criptografia e nós não armazenamos os dados do seu cartão.',
  },
  {
    q: 'Como acompanho a entrega?',
    a: 'Depois de confirmado, o pedido mostra cada etapa — em preparo, pronto e a caminho — na tela de acompanhamento. Você também recebe notificações de atualização.',
  },
  {
    q: 'Posso cancelar um pedido?',
    a: 'Pedidos podem ser cancelados enquanto ainda não foram preparados. Em caso de pagamento já efetuado, o estorno é processado automaticamente.',
  },
  {
    q: 'Como altero meus dados ou endereços?',
    a: 'Acesse a página do seu perfil para editar seu nome e gerenciar os endereços de entrega.',
  },
]

export default function AjudaPage() {
  return (
    <ContentPage
      eyebrow="Ajuda"
      title="Central de ajuda"
      subtitle="Respostas rápidas para as dúvidas mais comuns."
    >
      <div className="space-y-3">
        {FAQ.map((item) => (
          <details
            key={item.q}
            className="rounded-xl border border-neutral-200 bg-white [&_summary]:cursor-pointer"
          >
            <summary className="flex items-center justify-between px-4 py-3 text-sm font-semibold text-neutral-800 [&::-webkit-details-marker]:hidden">
              {item.q}
              <span className="text-neutral-400">+</span>
            </summary>
            <p className="border-t border-neutral-100 px-4 py-3 text-sm text-neutral-600">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="font-semibold text-neutral-800">Não encontrou o que procurava?</p>
        <p className="mt-1">
          Fale com a gente em{' '}
          <a href="mailto:suporte@brota.com.br" className="font-semibold text-brand-600 hover:underline">
            suporte@brota.com.br
          </a>
          . Você também pode conferir nossos{' '}
          <Link href="/termos" className="font-semibold text-brand-600 hover:underline">Termos de uso</Link>{' '}
          e a{' '}
          <Link href="/privacidade" className="font-semibold text-brand-600 hover:underline">Política de Privacidade</Link>.
        </p>
      </div>
    </ContentPage>
  )
}
