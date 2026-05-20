'use client'

import AdminGuard from '@/components/AdminGuard'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-neutral-100 p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  )
}
