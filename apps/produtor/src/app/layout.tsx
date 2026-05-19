import { AuthProvider } from '@marketplace/shared-services'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '900'],
})

export const metadata: Metadata = {
  title: {
    default: 'Painel do Produtor — Ambiente Livre',
    template: '%s | Ambiente Livre Produtor',
  },
  description: 'Gerencie sua horta, produtos e pedidos em tempo real.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
