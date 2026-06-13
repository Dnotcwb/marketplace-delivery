export default function PedidosLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse px-4 py-8">
      <div className="mb-6 h-7 w-40 rounded bg-neutral-200" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-neutral-200" />
              <div className="h-3 w-24 rounded bg-neutral-200" />
            </div>
            <div className="h-6 w-20 rounded-full bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  )
}
