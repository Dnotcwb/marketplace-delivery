import Logo from '@/components/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configurar minha horta — Ambiente Livre',
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <Logo variant="full" size={30} />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        {children}
      </main>
    </div>
  )
}
