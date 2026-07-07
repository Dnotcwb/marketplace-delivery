import type { Metadata } from 'next'
import ContentPage from '@/components/ContentPage'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Histórias dos nossos produtores, dicas de alimentação fresca e novidades do Brota.',
}

const POSTS = [
  {
    tag: 'Da horta',
    title: 'Por que comprar direto do produtor muda tudo',
    excerpt:
      'Frescor, preço justo e o dinheiro circulando na sua cidade — entenda o impacto do circuito curto de comercialização.',
  },
  {
    tag: 'Alimentação',
    title: 'Como conservar verduras por mais tempo',
    excerpt:
      'Dicas simples para reduzir o desperdício e manter seus alimentos fresquinhos por mais dias.',
  },
  {
    tag: 'Comunidade',
    title: 'Conheça quem planta o seu alimento',
    excerpt:
      'Histórias de produtores locais que fazem parte do Brota e transformam a agricultura da região.',
  },
]

export default function BlogPage() {
  return (
    <ContentPage
      eyebrow="Blog"
      title="Blog"
      subtitle="Histórias da horta, dicas de alimentação e novidades do Brota."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {POSTS.map((post) => (
          <article
            key={post.title}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              {post.tag}
            </span>
            <h2 className="mt-3 text-base font-bold text-neutral-900">{post.title}</h2>
            <p className="mt-1.5 text-sm text-neutral-500">{post.excerpt}</p>
            <span className="mt-3 inline-block text-xs font-medium text-neutral-400">Em breve</span>
          </article>
        ))}
      </div>
      <p className="pt-2 text-center text-neutral-400">
        Estamos preparando conteúdos novos. Volte em breve! 🌱
      </p>
    </ContentPage>
  )
}
