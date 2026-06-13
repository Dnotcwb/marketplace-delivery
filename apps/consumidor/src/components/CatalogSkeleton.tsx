/** Skeleton das páginas de catálogo (horta/[slug] e produtor/[slug]).
 *  Mostrado instantaneamente ao navegar, enquanto o SSR carrega os dados. */
export default function CatalogSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-48 w-full bg-neutral-200 sm:h-64" />

      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Logo + nome */}
        <div className="-mt-10 mb-4 flex items-end gap-4">
          <div className="h-20 w-20 flex-shrink-0 rounded-2xl border-4 border-white bg-neutral-300" />
          <div className="space-y-2 pb-1">
            <div className="h-6 w-48 rounded bg-neutral-200" />
            <div className="h-3 w-32 rounded bg-neutral-200" />
          </div>
        </div>

        {/* Pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {[88, 110, 120, 96].map((w, i) => (
            <div key={i} className="h-7 rounded-full bg-neutral-200" style={{ width: w }} />
          ))}
        </div>

        {/* Categorias + produtos */}
        <div className="mt-6 space-y-6">
          {Array.from({ length: 2 }).map((_, c) => (
            <div key={c}>
              <div className="mb-3 h-5 w-40 rounded bg-neutral-200" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 rounded-2xl border border-neutral-200 bg-white p-3">
                    <div className="h-16 w-16 flex-shrink-0 rounded-xl bg-neutral-200" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 w-3/4 rounded bg-neutral-200" />
                      <div className="h-3 w-1/2 rounded bg-neutral-200" />
                      <div className="h-4 w-20 rounded bg-neutral-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
