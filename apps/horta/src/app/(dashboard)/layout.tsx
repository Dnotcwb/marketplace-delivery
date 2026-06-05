'use client'

import HortaGuard from '@/components/HortaGuard'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <HortaGuard>
      <div className="flex h-screen overflow-hidden">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto bg-neutral-50 p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </HortaGuard>
  )
}
