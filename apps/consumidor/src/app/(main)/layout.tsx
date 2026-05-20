'use client'

import CartDrawer from '@/components/CartDrawer'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import { CartProvider } from '@marketplace/shared-services'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </CartProvider>
  )
}
