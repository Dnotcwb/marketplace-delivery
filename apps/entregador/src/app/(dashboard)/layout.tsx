import EntregadorGuard from '@/components/EntregadorGuard'
import { DriverDataProvider } from '@/components/DriverDataProvider'
import FcmRegistrar from '@/components/FcmRegistrar'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <EntregadorGuard>
      <DriverDataProvider>
        <div className="flex flex-col min-h-screen">
          <FcmRegistrar />
          <Topbar />
          {/* pb-20 no mobile garante que o conteúdo não fique atrás da bottom nav fixa */}
          <main className="flex-1 bg-neutral-50 p-4 pb-24 sm:pb-4">
            {children}
          </main>
        </div>
      </DriverDataProvider>
    </EntregadorGuard>
  )
}
