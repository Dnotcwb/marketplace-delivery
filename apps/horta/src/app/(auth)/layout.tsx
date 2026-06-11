import Logo from '@/components/Logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4">
      <div className="mb-8">
        <Logo variant="lockup" size={96} />
      </div>
      {children}
    </div>
  )
}
