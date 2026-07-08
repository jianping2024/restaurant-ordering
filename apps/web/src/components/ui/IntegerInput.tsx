'use client';

import { InputHTMLAttributes, useState } from 'react';
import { parseNonNegativeInt, sanitizeIntegerDraft } from '@/lib/number-input';

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

  const commitDraft = (raw: string) => {
    onChange(parseNonNegativeInt(raw, { min, max, empty: min }));
    setDraft(null);
  };

  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={draft !== null ? draft : String(value)}
      onFocus={(e) => {
        setDraft(clearZeroOnFocus && value === 0 ? '' : String(value));
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (draft !== null) commitDraft(draft);
        onBlur?.(e);
      }}
      onChange={(e) => setDraft(sanitizeIntegerDraft(e.target.value))}
      className={className}
    />
  );
}
