import Image from 'next/image'

interface LogoProps {
  /** 'full' = marca + nome (horizontal, cabeçalhos); 'mark' = só o ícone; 'lockup' = arte vertical completa (login/splash) */
  variant?: 'full' | 'mark' | 'lockup'
  /** Altura em px */
  size?: number
  /** Classe extra para o wrapper */
  className?: string
  /** Quando true, usa tons claros para fundos escuros */
  dark?: boolean
}

/**
 * Logo Brota Digital — usa a arte original (PNG transparente em alta resolução).
 * - mark:   apenas a mudinha + "B" (quadrado), serve em fundo claro e escuro.
 * - full:   marca + nome lado a lado (cabeçalhos); texto adapta ao fundo via `dark`.
 * - lockup: arte vertical completa (marca + "BROTA DIGITAL") para telas de login.
 */
export default function Logo({ variant = 'full', size = 36, className = '', dark = false }: LogoProps) {
  if (variant === 'lockup') {
    const w = Math.round((size * 701) / 660)
    return (
      <Image
        src={dark ? '/logo-dark.png' : '/logo.png'}
        alt="Brota Digital"
        width={w}
        height={size}
        className={`object-contain ${className}`}
        priority
      />
    )
  }

  const mark = (
    <Image src="/logo-mark.png" alt="Brota Digital" width={size} height={size} className="object-contain" priority />
  )

  if (variant === 'mark') {
    return <span className={`inline-flex ${className}`}>{mark}</span>
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {mark}
      <div className="leading-none">
        <div className={`text-[15px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>BROTA</div>
        <div className={`mt-[2px] text-[9px] font-semibold tracking-[0.3em] ${dark ? 'text-brand-300' : 'text-brand-600'}`}>DIGITAL</div>
      </div>
    </div>
  )
}
