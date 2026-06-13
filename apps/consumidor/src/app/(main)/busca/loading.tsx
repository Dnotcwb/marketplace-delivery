export default function BuscaLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6">
      <div className="mb-6 h-11 w-full rounded-xl bg-neutral-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="h-32 bg-neutral-200" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-3/4 rounded bg-neutral-200" />
              <div className="h-3 w-1/2 rounded bg-neutral-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
