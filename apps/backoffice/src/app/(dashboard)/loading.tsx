export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 rounded-lg bg-neutral-200" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-neutral-200" />
      <div className="h-64 rounded-xl bg-neutral-200" />
    </div>
  )
}
