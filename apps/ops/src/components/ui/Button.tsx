'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

const variants = {
  primary: 'bg-amber-500 text-zinc-950 hover:bg-amber-400 font-medium',
  outline: 'border border-zinc-600 text-zinc-200 hover:bg-zinc-800',
  danger: 'bg-red-600 text-white hover:bg-red-500 font-medium',
};

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
};

function ButtonSpinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      className = '',
      children,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const stringLabel = typeof children === 'string' ? children : undefined;
    const loadingAccessibleName = stringLabel ?? ariaLabel;

    return (
      <button
        ref={ref}
        {...props}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        aria-label={loading ? loadingAccessibleName : ariaLabel}
        className={`relative inline-flex items-center justify-center rounded-lg transition-colors ${
          loading ? 'cursor-wait' : 'disabled:cursor-not-allowed disabled:opacity-50'
        } ${variants[variant]} ${sizes[size]} ${className}`}
      >
        <span
          aria-hidden={loading || undefined}
          className={[
            'inline-flex items-center justify-center gap-2',
            loading ? 'invisible' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </span>
        {loading ? (
          <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center">
            <ButtonSpinner />
          </span>
        ) : null}
      </button>
    );
  },
);
Button.displayName = 'Button';
