'use client';

import { InputHTMLAttributes, useState } from 'react';
import { parseNonNegativeInt } from '@/lib/number-input';

type IntegerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  clearZeroOnFocus?: boolean;
};

export function IntegerInput({
  value,
  onChange,
  min = 0,
  max,
  className = '',
  clearZeroOnFocus = false,
  onFocus,
  onBlur,
  ...props
}: IntegerInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={clearZeroOnFocus && draft !== null ? draft : value}
      onFocus={
        clearZeroOnFocus
          ? (e) => {
              if (value === 0) setDraft('');
              onFocus?.(e);
            }
          : onFocus
      }
      onBlur={
        clearZeroOnFocus
          ? (e) => {
              setDraft(null);
              onBlur?.(e);
            }
          : onBlur
      }
      onChange={(e) => {
        const raw = e.target.value;
        if (clearZeroOnFocus) setDraft(raw);
        onChange(parseNonNegativeInt(raw, { min, max, empty: min }));
      }}
      className={className}
    />
  );
}
