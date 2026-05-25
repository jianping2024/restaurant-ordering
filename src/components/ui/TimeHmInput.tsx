'use client';

import { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/Input';
import { buffetTimeFieldClass } from '@/components/dashboard/buffet/buffet-field-styles';
import { normalizeHmInput } from '@/lib/number-input';

type TimeHmInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Dense inline layout for buffet tables (matches `buffetFieldClass`). */
  compact?: boolean;
};

export function TimeHmInput({
  label,
  value,
  onChange,
  className = '',
  compact = false,
  onBlur,
  ...props
}: TimeHmInputProps) {
  const mergedBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const normalized = normalizeHmInput(value);
    if (normalized) onChange(normalized);
    onBlur?.(e);
  };

  const inputProps = {
    type: 'text' as const,
    inputMode: 'numeric' as const,
    autoComplete: 'off' as const,
    placeholder: '12:00',
    maxLength: 5,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
      onChange(v);
    },
    ...props,
    onBlur: mergedBlur,
  };

  if (compact) {
    const input = (
      <input
        {...inputProps}
        className={`${buffetTimeFieldClass} ${className}`.trim()}
      />
    );
    if (!label) return input;
    return (
      <label className="flex flex-col gap-1 min-w-0">
        <span className="text-[11px] text-brand-text-muted">{label}</span>
        {input}
      </label>
    );
  }

  return (
    <Input
      label={label}
      className={`max-w-[7.5rem] ${className}`}
      {...inputProps}
    />
  );
}
