// Função agendada do Netlify que "aquece" os 5 apps a cada 5 minutos.
//
// Por quê: no plano gratuito do Netlify as funções serverless dormem após
// ociosidade; a primeira requisição paga um cold start de ~1s. Pingar uma
// rota de cada site mantém o handler Next de cada app sempre quente, então a
// navegação do usuário cai de ~1s (cold) para ~100ms (quente).
//
// Um ping por site basta: o runtime do Next no Netlify serve todas as rotas
// SSR/ISR a partir de uma única função, então aquecer uma rota aquece o app.

const URLS = [
  'https://marketplace-delivery-consumidor.netlify.app/',
  'https://marketplace-delivery-produtor.netlify.app/login',
  'https://marketplace-delivery-backoffice.netlify.app/login',
  'https://marketplace-entregador.netlify.app/login',
  'https://marketplace-delivery-horta.netlify.app/login',
]

export default async () => {
  const results = await Promise.allSettled(
    URLS.map((url) =>
      fetch(url, { method: 'GET', headers: { 'x-keep-warm': '1' } }).then((r) => r.status),
    ),
  )
  const summary = results.map((r, i) => `${URLS[i]} → ${r.status === 'fulfilled' ? r.value : 'erro'}`)
  console.log('keep-warm:', summary.join(' | '))
  return new Response('warmed', { status: 200 })
}

export const config = {
  schedule: '*/5 * * * *',
}
