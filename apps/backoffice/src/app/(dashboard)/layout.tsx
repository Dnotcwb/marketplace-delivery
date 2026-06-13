'use client'

import { useState } from 'react'
import AdminGuard from '@/components/AdminGuard'
import { AdminDataProvider } from '@/components/AdminDataProvider'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <AdminGuard>
      <AdminDataProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Topbar onMenuClick={() => setSidebarOpen(true)} />
            <main className="flex-1 overflow-y-auto bg-neutral-100 p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>
      </AdminDataProvider>
    </AdminGuard>
  )
}
