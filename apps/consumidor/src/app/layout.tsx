import { AuthProvider } from '@marketplace/shared-services'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '900'],
})

export const metadata: Metadata = {
  title: {
    default: 'Brota Digital — Delivery',
    template: '%s | Brota Digital',
  },
  description: 'Compre direto de produtores e hortas urbanas da sua região com entrega rápida.',
  keywords: ['delivery', 'hortas', 'produtos orgânicos', 'agroecologia', 'pedido online', 'Brota Digital'],
  openGraph: {
    title: 'Brota Digital — Delivery',
    description: 'Compre direto de produtores e hortas urbanas da sua região.',
    type: 'website',
    locale: 'pt_BR',
    images: [{ url: '/logo.png', width: 512, height: 512 }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Brota Digital',
  },
  formatDetection: { telephone: false },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-white text-neutral-900 antialiased">
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
