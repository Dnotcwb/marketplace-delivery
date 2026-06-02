import Image from 'next/image'

interface LogoProps {
  /** 'full' mostra ícone + nome; 'mark' mostra só o ícone */
  variant?: 'full' | 'mark'
  /** Tamanho do ícone em px (height) */
  size?: number
  /** Classe extra para o wrapper */
  className?: string
  /** Quando true, o nome da marca usa texto claro (para fundos escuros) */
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
          <span className={`text-sm font-bold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>Bro</span><span className="text-sm font-bold tracking-tight text-brand-500">ta</span>
        </div>
      )}
    </div>
  )
}
