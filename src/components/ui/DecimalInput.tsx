'use client';

import { InputHTMLAttributes, useEffect, useState } from 'react';
import { formatDecimalInputValue, normalizeDecimalInput, parseDecimalInput } from '@/lib/number-input';

type DecimalInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

export function DecimalInput({
  value,
  onChange,
  min = 0,
  max,
  className = '',
  ...props
}: DecimalInputProps) {
  const [text, setText] = useState(() => formatDecimalInputValue(value));

  useEffect(() => {
    setText(formatDecimalInputValue(value));
  }, [value]);

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={text}
      onChange={(e) => {
        const normalized = normalizeDecimalInput(e.target.value);
        setText(normalized);
        onChange(parseDecimalInput(normalized, { min, max }));
      }}
      onBlur={() => {
        const n = parseDecimalInput(text, { min, max });
        const formatted = formatDecimalInputValue(n);
        setText(formatted);
        onChange(n);
      }}
      className={className}
    />
  );
}
