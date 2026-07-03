'use client';

import type { ByItemLineStatusTone } from '@/lib/bill-split-by-item';

export type ByItemDishAllocatorHeaderLabels = {
  buffetComplete: string;
  expandDetails: string;
  collapseDetails: string;
};

const STATUS_TONE_CLASS = {
  success: 'text-emerald-600',
  alert: 'text-red-500',
} as const;

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type Props = {
  title: React.ReactNode;
  statusSummary: { text: string; tone: ByItemLineStatusTone };
  lineTotal: number;
  expanded: boolean;
  labels: ByItemDishAllocatorHeaderLabels;
  onToggleExpand: () => void;
};

export function ByItemDishAllocatorHeader({
  title,
  statusSummary,
  lineTotal,
  expanded,
  labels,
  onToggleExpand,
}: Props) {
  const isComplete = statusSummary.tone === 'success';

  return (
    <div className={`flex gap-3 ${expanded ? 'items-start mb-3' : 'items-center'}`}>
      <div className="min-w-0 flex-1">
        {expanded ? (
          <>
            <p className="text-brand-text text-sm leading-snug">{title}</p>
            <p className={`text-[12px] mt-1 font-medium ${STATUS_TONE_CLASS[statusSummary.tone]}`}>
              {statusSummary.text}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <p className="min-w-0 text-brand-text text-sm leading-snug truncate">{title}</p>
            {isComplete ? (
              <span className="shrink-0 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium leading-none text-emerald-600">
                {labels.buffetComplete}
              </span>
            ) : (
              <span className={`shrink min-w-0 truncate text-[11px] font-medium ${STATUS_TONE_CLASS.alert}`}>
                {statusSummary.text}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="text-brand-gold text-[13px] tabular-nums">€{lineTotal.toFixed(2)}</span>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? labels.collapseDetails : labels.expandDetails}
          aria-expanded={expanded}
          className="w-8 h-8 rounded-lg text-brand-text-muted hover:text-brand-gold hover:bg-brand-gold/10 transition-colors flex items-center justify-center"
        >
          <ChevronIcon expanded={expanded} />
        </button>
      </div>
    </div>
  );
}
