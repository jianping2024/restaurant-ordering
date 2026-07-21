'use client';

import Link from 'next/link';
import { ButtonHTMLAttributes, ComponentProps, forwardRef } from 'react';

export type ButtonVariant = 'gold' | 'outline' | 'ghost' | 'danger' | 'soft' | 'close';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'action';

export const buttonIcon = {
  sm: 'h-3.5 w-3.5 shrink-0',
  md: 'h-4 w-4 shrink-0',
} as const;

const baseClass =
  'relative inline-flex items-center justify-center outline-none transition-all duration-200 cursor-pointer focus-visible:ring-2';

const variants: Record<ButtonVariant, string> = {
  gold:
    'border border-transparent bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light font-semibold shadow-sm shadow-black/10 active:scale-[0.98] focus-visible:ring-brand-gold/45',
  outline: 'border border-brand-gold text-brand-gold hover:bg-brand-gold/10 font-semibold focus-visible:ring-brand-gold/30',
  ghost:
    'text-brand-text-muted hover:text-brand-text hover:bg-brand-border font-medium focus-visible:ring-brand-gold/30',
  danger: 'bg-red-600 text-white hover:bg-red-700 font-semibold focus-visible:ring-red-400/40',
  soft:
    'border border-transparent bg-brand-border/30 text-brand-text hover:bg-brand-border/50 font-medium focus-visible:ring-brand-gold/30',
  close:
    'border border-rose-500 bg-brand-card text-rose-700 hover:bg-rose-500/8 font-medium focus-visible:ring-rose-400/40',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'gap-2 px-3 py-1.5 text-[13px] rounded-lg',
  md: 'gap-2 px-5 py-2.5 text-[15px] rounded-lg',
  lg: 'gap-2 px-7 py-3.5 text-base rounded-lg',
  /** Floor / session action bar — readable next to list-body text-lg content. */
  action: 'gap-2 px-4 py-2.5 text-[15px] font-semibold rounded-xl',
};

export function buttonClasses({
  variant = 'gold',
  size = 'md',
  className = '',
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return [baseClass, variants[variant], sizes[size], className].filter(Boolean).join(' ');
}

function ButtonSpinner() {
  return (
    <svg className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'gold',
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
        className={[
          buttonClasses({ variant, size, className }),
          loading ? 'cursor-wait' : 'disabled:cursor-not-allowed disabled:opacity-50',
        ]
          .filter(Boolean)
          .join(' ')}
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

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
};

export function ButtonLink({
  variant = 'gold',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...props
}: ButtonLinkProps) {
  const classes = buttonClasses({
    variant,
    size,
    className: `no-underline disabled:opacity-50 disabled:cursor-not-allowed${disabled ? ' opacity-50 pointer-events-none' : ''}${className ? ` ${className}` : ''}`,
  });

  if (disabled) {
    return <span className={classes}>{children}</span>;
  }

  return (
    <Link className={classes} {...props}>
      {children}
    </Link>
  );
}
