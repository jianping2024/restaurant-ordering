'use client';

type Props = {
  /** Hidden when the dish line has only one payer row. */
  rowCount: number;
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

export function ByItemConsumerRowRemoveButton({ rowCount, ariaLabel, onRemove }: Props) {
  if (rowCount <= 1) return null;

  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={ariaLabel}
      className="w-8 h-8 shrink-0 rounded-lg text-brand-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center"
    >
      <TrashIcon className="w-4 h-4" />
    </button>
  );
}
