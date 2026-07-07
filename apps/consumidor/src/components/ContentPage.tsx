import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * Wrapper visual padrão para páginas institucionais/estáticas (Sobre, Termos,
 * Ajuda, etc.). Mantém um cabeçalho consistente, com hero em gradiente da
 * marca, e uma área de conteúdo com tipografia cuidada.
 */
export default function ContentPage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  /** Rótulo pequeno acima do título (ex.: "Institucional", "Ajuda") */
  eyebrow?: string
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-brand-100 bg-gradient-to-b from-brand-50 to-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-100/50 blur-3xl"
        />
        <div className="relative mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
          <nav className="mb-4 text-xs text-neutral-400" aria-label="Navegação">
            <Link href="/" className="transition-colors hover:text-brand-600">Início</Link>
            <span className="mx-1.5">/</span>
            <span className="text-neutral-500">{title}</span>
          </nav>
          {eyebrow && (
            <span className="mb-3 inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-base text-neutral-600 sm:text-lg">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div
          className="space-y-6 text-[15px] leading-relaxed text-neutral-600 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-neutral-900 [&_a]:text-brand-600 [&_strong]:text-neutral-800"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
