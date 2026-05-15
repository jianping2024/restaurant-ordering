'use client';

import { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/Input';
import { normalizeHmInput } from '@/lib/number-input';

type TimeHmInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  label?: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimeHmInput({ label, value, onChange, className = '', ...props }: TimeHmInputProps) {
  return (
    <Input
      label={label}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="12:00"
      maxLength={5}
      value={value}
      className={`max-w-[7.5rem] ${className}`}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d:]/g, '').slice(0, 5);
        onChange(v);
      }}
      onBlur={() => {
        const normalized = normalizeHmInput(value);
        if (normalized) onChange(normalized);
      }}
      {...props}
    />
  );
}
