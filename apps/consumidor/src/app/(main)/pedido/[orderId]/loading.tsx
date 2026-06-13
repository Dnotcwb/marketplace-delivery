export default function PedidoLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-neutral-200" />
          <div className="h-3 w-28 rounded bg-neutral-200" />
        </div>
        <div className="h-6 w-24 rounded-full bg-neutral-200" />
      </div>
      <div className="mb-6 space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-neutral-200" />
            <div className="h-4 w-40 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 h-4 w-20 rounded bg-neutral-200" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="mb-2 flex justify-between">
            <div className="h-4 w-40 rounded bg-neutral-200" />
            <div className="h-4 w-16 rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
