'use client';

import { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/Input';
import { buffetTimeFieldClass } from '@/components/dashboard/buffet/buffet-field-styles';
import { formatHmDigitsWhileTyping, normalizeHmInput } from '@/lib/number-input';

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
  const normalized = normalizeHmInput(value);
  const invalid = value.trim().length > 0 && !normalized;
  const invalidClass = invalid ? 'border-red-400 focus:border-red-500' : '';

  const mergedBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (normalized) {
      onChange(normalized);
    } else if (value.trim()) {
      onChange('');
    }
    onBlur?.(e);
  };

  const inputProps = {
    type: 'text' as const,
    inputMode: 'numeric' as const,
    autoComplete: 'off' as const,
    placeholder: '12:00',
    maxLength: 5,
    'aria-invalid': invalid || undefined,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(formatHmDigitsWhileTyping(e.target.value));
    },
    ...props,
    onBlur: mergedBlur,
  };

  if (compact) {
    const input = (
      <input
        {...inputProps}
        className={`${buffetTimeFieldClass} ${invalidClass} ${className}`.trim()}
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
      className={`max-w-[7.5rem] ${invalidClass} ${className}`}
      {...inputProps}
    />
  );
}
