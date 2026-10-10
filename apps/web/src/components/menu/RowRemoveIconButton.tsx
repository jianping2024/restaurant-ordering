'use client';

import { buttonPressReliefCompactClass } from '@/components/ui/button-press-relief';

type Props = {
  /** False when the row must stay (e.g. last by-item payer). */
  removable: boolean;
  ariaLabel: string;
  onRemove: () => void;
  /** Extra lock (e.g. cart submit in flight). */
  disabled?: boolean;
};

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 4.5h9M6 4.5V3.25A.75.75 0 0 1 6.75 2.5h2.5a.75.75 0 0 1 .75.75V4.5M6 7v4.25M10 7v4.25M4.25 4.5l.5 8a1 1 0 0 0 1 .875h4.5a1 1 0 0 0 1-.875l.5-8"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SLOT_CLASS =
  `w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-all duration-200 ${buttonPressReliefCompactClass}`;

/** Sole trash icon remove control (cart lines, by-item / buffet consumer rows). */
export function RowRemoveIconButton({ removable, ariaLabel, onRemove, disabled = false }: Props) {
  if (!removable || disabled) {
    return (
      <div
        aria-hidden
        className={`${SLOT_CLASS} border border-transparent text-brand-text-muted/30 ${disabled ? 'opacity-40' : ''}`}
      >
        <TrashIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={`${SLOT_CLASS} border border-brand-border/70 bg-brand-bg text-brand-text-muted hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/25`}
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  );
}
