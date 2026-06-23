'use client';

import { InputHTMLAttributes } from 'react';
import { parseNonNegativeInt } from '@/lib/number-input';

type IntegerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function IntegerInput({
  value,
  onChange,
  min = 0,
  max,
  className = '',
  ...props
}: IntegerInputProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(e) => {
        onChange(parseNonNegativeInt(e.target.value, { min, max, empty: min }));
      }}
      className={className}
    />
  );
}
