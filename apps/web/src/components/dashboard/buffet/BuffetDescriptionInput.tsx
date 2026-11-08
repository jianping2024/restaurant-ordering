'use client';

import { useEffect, useId, useState } from 'react';
import {
  BUFFET_DESCRIPTION_MAX_CHARS,
  normalizeBuffetDescription,
} from '@/lib/buffet-update-patch';

type Props = {
  value: string | null;
  label: string;
  placeholder: string;
  /** Called on blur only when the normalized text changed. */
  onSave: (description: string | null) => void;
  className?: string;
};

/** Cap by characters (code points), matching PG `char_length` — never UTF-16 `maxLength`. */
function clampDescription(raw: string): string {
  return Array.from(raw).slice(0, BUFFET_DESCRIPTION_MAX_CHARS).join('');
}

/** Sole buffet「描述」editor (buffet list row): ≤ 40 chars, autosave on blur, empty = null. */
export function BuffetDescriptionInput({ value, label, placeholder, onSave, className = '' }: Props) {
  const id = useId();
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const count = Array.from(draft).length;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="flex justify-between gap-2 text-[12px] text-brand-text-muted">
        <span>{label}</span>
        <span aria-live="polite">
          {count} / {BUFFET_DESCRIPTION_MAX_CHARS}
        </span>
      </label>
      <textarea
        id={id}
        rows={2}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(clampDescription(e.target.value))}
        onBlur={() => {
          const next = normalizeBuffetDescription(draft);
          setDraft(next ?? '');
          if (next !== (value ?? null)) onSave(next);
        }}
        className={`w-full resize-y ${className}`}
      />
    </div>
  );
}
