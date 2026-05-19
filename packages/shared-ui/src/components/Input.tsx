import * as React from 'react'

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string
  helperText?: string
  error?: string
  /** Elemento à esquerda do input (ícone, prefixo) */
  leftElement?: React.ReactNode
  /** Elemento à direita do input (ícone, sufixo) */
  rightElement?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, leftElement, rightElement, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const hasError = !!error

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-error" aria-hidden="true">*</span>
            )}
          </label>
        )}

        <div className="relative flex items-center">
          {leftElement && (
            <div className="pointer-events-none absolute left-3 flex items-center text-neutral-400">
              {leftElement}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-describedby={
              error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined
            }
            aria-invalid={hasError}
            className={[
              'block w-full rounded-lg border bg-white py-2 text-sm text-neutral-900',
              'placeholder-neutral-400 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              leftElement ? 'pl-10' : 'pl-3',
              rightElement ? 'pr-10' : 'pr-3',
              hasError
                ? 'border-error focus:border-error focus:ring-error/30'
                : 'border-neutral-300 focus:border-brand-500 focus:ring-brand-500/20',
              props.disabled ? 'cursor-not-allowed bg-neutral-50 text-neutral-400' : '',
              className,
            ].join(' ')}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 flex items-center text-neutral-400">
              {rightElement}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="text-xs text-error" role="alert">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-xs text-neutral-500">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
