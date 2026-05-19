import * as React from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'outline' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Ícone à esquerda do texto */
  leftIcon?: React.ReactNode
  /** Ícone à direita do texto */
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:     'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 disabled:bg-brand-200 disabled:text-brand-50 focus-visible:ring-brand-500',
  secondary:   'bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300 disabled:opacity-50 focus-visible:ring-neutral-400',
  ghost:       'bg-transparent text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:opacity-50 focus-visible:ring-neutral-400',
  outline:     'border border-brand-500 bg-transparent text-brand-600 hover:bg-brand-50 active:bg-brand-100 disabled:opacity-50 focus-visible:ring-brand-500',
  destructive: 'bg-error text-white hover:bg-red-700 active:bg-red-800 disabled:bg-red-300 focus-visible:ring-red-500',
  link:        'bg-transparent text-brand-600 underline-offset-4 hover:underline hover:text-brand-700 disabled:opacity-50 focus-visible:ring-brand-500 h-auto p-0',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8  px-3   text-sm   gap-1.5',
  md: 'h-10 px-4   text-sm   gap-2',
  lg: 'h-12 px-6   text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const isLink = variant === 'link'
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={[
        'inline-flex items-center justify-center font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none',
        isLink ? '' : 'rounded-lg',
        variantClasses[variant],
        isLink ? '' : sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
