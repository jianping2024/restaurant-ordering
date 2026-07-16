'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';

type PasswordInputVariant = 'brand' | 'zinc';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  variant?: PasswordInputVariant;
  labelClassName?: string;
  inputClassName?: string;
  toggleClassName?: string;
  showPasswordLabel?: string;
  hidePasswordLabel?: string;
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" />
    </svg>
  );
}

const VARIANT_DEFAULTS: Record<
  PasswordInputVariant,
  {
    labelLayout: 'stack' | 'wrap';
    labelClassName: string;
    inputClassName: string;
    toggleClassName: string;
    toggleIconClassName: string;
    showPasswordLabel: string;
    hidePasswordLabel: string;
  }
> = {
  brand: {
    labelLayout: 'stack',
    labelClassName: 'text-sm text-brand-text-muted font-medium',
    inputClassName:
      'w-full bg-brand-card border rounded-lg px-4 py-2.5 pr-11 text-base text-brand-text placeholder-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/50 transition-colors duration-200 border-brand-border',
    toggleClassName:
      'absolute right-3 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-brand-text disabled:opacity-50 disabled:pointer-events-none',
    toggleIconClassName: 'w-5 h-5',
    showPasswordLabel: 'Show password',
    hidePasswordLabel: 'Hide password',
  },
  zinc: {
    labelLayout: 'wrap',
    labelClassName: 'block text-sm text-zinc-400',
    inputClassName:
      'mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10 text-white',
    toggleClassName:
      'absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 disabled:opacity-50 disabled:pointer-events-none',
    toggleIconClassName: 'h-5 w-5',
    showPasswordLabel: '显示密码',
    hidePasswordLabel: '隐藏密码',
  },
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      label,
      error,
      variant = 'brand',
      labelClassName,
      inputClassName,
      toggleClassName,
      showPasswordLabel,
      hidePasswordLabel,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const defaults = VARIANT_DEFAULTS[variant];
    const resolvedLabelClassName = labelClassName ?? defaults.labelClassName;
    const resolvedInputClassName = inputClassName ?? defaults.inputClassName;
    const resolvedToggleClassName = toggleClassName ?? defaults.toggleClassName;
    const resolvedShowLabel = showPasswordLabel ?? defaults.showPasswordLabel;
    const resolvedHideLabel = hidePasswordLabel ?? defaults.hidePasswordLabel;
    const errorBorder = error ? 'border-red-500' : '';

    const field = (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          disabled={disabled}
          className={`${resolvedInputClassName} ${errorBorder} ${className}`.trim()}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          className={resolvedToggleClassName}
          aria-label={visible ? resolvedHideLabel : resolvedShowLabel}
        >
          {visible ? (
            <EyeOffIcon className={defaults.toggleIconClassName} />
          ) : (
            <EyeIcon className={defaults.toggleIconClassName} />
          )}
        </button>
      </div>
    );

    if (defaults.labelLayout === 'wrap') {
      if (!label) return field;
      return (
        <label className={resolvedLabelClassName}>
          {label}
          {field}
        </label>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        {label ? <label className={resolvedLabelClassName}>{label}</label> : null}
        {field}
        {error ? <p className="mesa-text-danger text-[13px]">{error}</p> : null}
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';
