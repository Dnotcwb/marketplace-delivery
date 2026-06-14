import { listHortasAtivas, listProdutoresAprovados } from '@marketplace/shared-services'
import HomeContent from '@/components/HomeContent'

export const revalidate = 300

export const metadata = {
  title: 'Hortas e produtores perto de você',
  description: 'Produtos frescos, direto do campo para a sua mesa. Compre de hortas e produtores locais.',
}

export default async function HomePage() {
  const [hortas, produtores] = await Promise.all([
    listHortasAtivas(),
    listProdutoresAprovados(),
  ])

  const serializableHortas = hortas.map(({ createdAt: _c, updatedAt: _u, ...r }) => r)
  const serializableProdutores = produtores.map(({ createdAt: _c, updatedAt: _u, ...r }) => r)

  return <HomeContent hortas={serializableHortas} produtores={serializableProdutores} />
}
