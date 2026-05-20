import EntregadorGuard from '@/components/EntregadorGuard'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntregadorGuard>
      <div className="flex flex-col min-h-screen">
        <Topbar />
        <main className="flex-1 bg-neutral-50 p-4">
          {children}
        </main>
      </div>
    </EntregadorGuard>
  )
}
