'use client';

import { buttonPressReliefCompactClass } from '@/components/ui/button-press-relief';

type Props = {
  /** False when the row must stay (e.g. last by-item payer). */
  removable: boolean;
  ariaLabel: string;
  onRemove: () => void;
  /** Extra lock (e.g. cart submit in flight). */
  disabled?: boolean;
  /** Staff touch target: 44px, red icon (by-item share rows). */
  large?: boolean;
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

const SLOT_BASE_CLASS =
  `shrink-0 flex items-center justify-center transition-all duration-200 ${buttonPressReliefCompactClass}`;
const SLOT_CLASS = `${SLOT_BASE_CLASS} w-8 h-8 rounded-lg`;
const SLOT_LARGE_CLASS = `${SLOT_BASE_CLASS} ml-1 h-11 w-11 rounded-xl`;

/** Sole trash icon remove control (cart lines, by-item / buffet consumer rows). */
export function RowRemoveIconButton({
  removable,
  ariaLabel,
  onRemove,
  disabled = false,
  large = false,
}: Props) {
  const slotClass = large ? SLOT_LARGE_CLASS : SLOT_CLASS;
  const iconClass = large ? 'w-5 h-5' : 'w-4 h-4';
  if (!removable || disabled) {
    return (
      <div
        aria-hidden
        className={`${slotClass} border border-transparent text-brand-text-muted/30 ${disabled ? 'opacity-40' : ''}`}
      >
        <TrashIcon className={iconClass} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={`${slotClass} border bg-brand-bg hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/25 ${
        large ? 'border-red-500/35 text-red-500' : 'border-brand-border/70 text-brand-text-muted'
      }`}
    >
      <TrashIcon className={iconClass} />
    </button>
  );
}
