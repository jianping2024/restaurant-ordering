'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-brand-text-muted font-medium">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full bg-brand-card border rounded-lg px-4 py-2.5
            text-[15px] text-brand-text placeholder-brand-muted
            focus:outline-none focus:ring-2 focus:ring-brand-gold/50
            transition-colors duration-200
            ${error ? 'border-red-500' : 'border-brand-border'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-red-400 text-[13px]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
