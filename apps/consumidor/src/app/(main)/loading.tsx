export default function MainLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-8 sm:px-6">
      {/* Hero */}
      <div className="mb-8 space-y-2">
        <div className="h-8 w-72 rounded-lg bg-neutral-200" />
        <div className="h-4 w-48 rounded-lg bg-neutral-200" />
      </div>

      {/* Filtros */}
      <div className="mb-6 flex gap-2">
        {[80, 96, 112, 80, 96].map((w, i) => (
          <div key={i} className={`h-8 w-${w} flex-shrink-0 rounded-full bg-neutral-200`} />
        ))}
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="h-32 bg-neutral-200" />
            <div className="space-y-2 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 flex-shrink-0 rounded-full bg-neutral-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 rounded bg-neutral-200" />
                  <div className="h-3 w-1/2 rounded bg-neutral-200" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded bg-neutral-200" />
                <div className="h-3 w-24 rounded bg-neutral-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
