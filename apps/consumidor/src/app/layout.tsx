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
    default: 'Ambiente Livre — Delivery',
    template: '%s | Ambiente Livre',
  },
  description: 'Compre direto de produtores e hortas urbanas da sua região com entrega rápida.',
  keywords: ['delivery', 'hortas', 'produtos orgânicos', 'agroecologia', 'pedido online', 'Ambiente Livre'],
  openGraph: {
    title: 'Ambiente Livre — Delivery',
    description: 'Compre direto de produtores e hortas urbanas da sua região.',
    type: 'website',
    locale: 'pt_BR',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-neutral-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
