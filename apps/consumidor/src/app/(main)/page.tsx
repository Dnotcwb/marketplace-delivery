export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="text-center">
        <div className="mb-6 text-6xl">🍔</div>
        <h1 className="mb-2 text-3xl font-bold text-neutral-900">
          Bem-vindo ao Delivery
        </h1>
        <p className="mb-8 text-neutral-500">
          Os melhores restaurantes na sua porta.
        </p>
        <p className="text-sm text-neutral-400">
          Em breve: listagem de restaurantes por região.
        </p>
      </div>
    </div>
  )
}
