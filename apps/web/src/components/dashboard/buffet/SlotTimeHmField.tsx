'use client';

import { useEffect, useState } from 'react';
import { TimeHmInput } from '@/components/ui/TimeHmInput';
import { normalizeHmInput } from '@/lib/number-input';

type Props = {
  /** PostgreSQL `time` or HH:MM(:SS) from API. */
  dbTime: string;
  onCommit: (hm: string) => void;
  label?: string;
  className?: string;
  compact?: boolean;
};

/** 24h HH:MM field; commits normalized value on blur when changed. */
export function SlotTimeHmField({ dbTime, onCommit, label, className, compact }: Props) {
  const stored = dbTime?.slice(0, 5) || '12:00';
  const [draft, setDraft] = useState(stored);

  useEffect(() => {
    setDraft(stored);
  }, [stored]);

  return (
    <TimeHmInput
      compact={compact}
      label={label}
      className={className}
      value={draft}
      onChange={setDraft}
      onBlur={() => {
        const normalized = normalizeHmInput(draft);
        if (!normalized) {
          setDraft(stored);
          return;
        }
        setDraft(normalized);
        if (normalized !== stored) onCommit(normalized);
      }}
    />
  );
}
