'use client';

import Link from 'next/link';
import { ButtonHTMLAttributes, ComponentProps, forwardRef } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export type ButtonVariant = 'gold' | 'outline' | 'ghost' | 'danger' | 'soft' | 'close';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'action';

export const buttonIcon = {
  sm: 'h-3.5 w-3.5 shrink-0',
  md: 'h-4 w-4 shrink-0',
} as const;

const baseClass =
  'relative inline-flex items-center justify-center outline-none transition-all duration-200 cursor-pointer focus-visible:ring-2';

const variants: Record<ButtonVariant, string> = {
  /**
   * Primary face — azulejo ink (variant id `gold` kept for call-site stability).
   * Sole strong-relief + press-in feedback for staff/customer primary CTAs.
   */
  gold:
    'border border-transparent bg-brand-ink text-brand-on-ink hover:bg-brand-ink-light font-semibold focus-visible:ring-brand-ink/45 shadow-[0_5px_0_0_rgb(0_0_0/0.35),0_8px_16px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-1px_0_rgb(0_0_0/0.2)] enabled:active:translate-y-[4px] enabled:active:bg-[rgb(var(--color-brand-ink)/0.92)] enabled:active:shadow-[0_0_0_0_rgb(0_0_0/0),0_2px_4px_rgb(0_0_0/0.16),inset_0_5px_10px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(0_0_0/0.25)] motion-reduce:enabled:active:translate-y-0',
  outline:
    'border border-brand-ink text-brand-ink hover:bg-brand-ink/10 font-semibold focus-visible:ring-brand-ink/30',
  ghost:
    'text-brand-text-muted hover:text-brand-text hover:bg-brand-border font-medium focus-visible:ring-brand-ink/30',
  danger: 'bg-red-600 text-white hover:bg-red-700 font-semibold focus-visible:ring-red-400/40',
  soft:
    'border border-transparent bg-brand-border/30 text-brand-text hover:bg-brand-border/50 font-medium focus-visible:ring-brand-ink/30',
  close:
    'border border-rose-500 bg-brand-card text-rose-700 hover:bg-rose-500/8 font-medium focus-visible:ring-rose-400/40',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'gap-2 px-3 py-1.5 text-[13px] rounded-lg',
  md: 'gap-2 px-5 py-2.5 text-[15px] rounded-lg',
  lg: 'gap-2 px-7 py-3.5 text-base rounded-lg',
  /** Floor / session / modal / checkout 收款 — 52px touch. */
  action: 'min-h-[52px] gap-2 px-5 py-3 text-base font-semibold rounded-xl',
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
            <Spinner />
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
