import Image from 'next/image'

interface LogoProps {
  variant?: 'full' | 'mark'
  size?: number
  className?: string
  dark?: boolean
}

export default function Logo({ variant = 'full', size = 36, className = '', dark = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/logo.png"
        alt="Brota"
        width={size}
        height={Math.round(size * 1.22)}
        className="w-auto object-contain"
        style={{ height: size }}
        priority
      />
      {variant === 'full' && (
        <div className="leading-none">
          <span className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>Bro</span>
          <span className={`text-sm font-bold tracking-tight ${dark ? 'text-brand-300' : 'text-brand-500'}`}>ta</span>
        </div>
      )}
    </div>
  )
}
