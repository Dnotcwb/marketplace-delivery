import * as React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove o padding interno (útil quando o conteúdo vai até a borda) */
  noPadding?: boolean
  /** Variante visual */
  variant?: 'default' | 'outlined' | 'flat'
}

export function Card({ noPadding = false, variant = 'default', className = '', children, ...props }: CardProps) {
  const variantClasses = {
    default:  'bg-white shadow-sm border border-neutral-200',
    outlined: 'bg-white border border-neutral-300',
    flat:     'bg-neutral-50',
  }

  return (
    <div
      {...props}
      className={[
        'rounded-xl',
        variantClasses[variant],
        noPadding ? '' : 'p-5',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  action?: React.ReactNode
}

export function CardHeader({ title, description, action, className = '', ...props }: CardHeaderProps) {
  return (
    <div {...props} className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
        {description && (
          <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function CardDivider({ className = '' }: { className?: string }) {
  return <div className={`-mx-5 my-4 border-t border-neutral-100 ${className}`} />
}
