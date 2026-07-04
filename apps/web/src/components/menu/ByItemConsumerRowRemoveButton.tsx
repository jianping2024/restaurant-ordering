'use client';

type Props = {
  /** False when the dish line must keep at least one payer row. */
  removable: boolean;
  ariaLabel: string;
  onRemove: () => void;
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
  'w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors';

export function ByItemConsumerRowRemoveButton({ removable, ariaLabel, onRemove }: Props) {
  if (!removable) {
    return (
      <div aria-hidden className={`${SLOT_CLASS} text-brand-text-muted/30`}>
        <TrashIcon className="w-4 h-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className={`${SLOT_CLASS} text-brand-text-muted hover:text-red-500 hover:bg-red-500/10`}
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  );
}
