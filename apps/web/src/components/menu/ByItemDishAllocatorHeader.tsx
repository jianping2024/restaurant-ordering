'use client';

import type { ByItemLineStatusTone } from '@/lib/bill-split-by-item';

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
  expandLabel: string;
  collapseLabel: string;
  onToggleExpand: () => void;
};

export function ByItemDishAllocatorHeader({
  title,
  statusSummary,
  lineTotal,
  expanded,
  expandLabel,
  collapseLabel,
  onToggleExpand,
}: Props) {
  return (
    <div className={`flex items-start justify-between gap-3 ${expanded ? 'mb-3' : ''}`}>
      <div className="min-w-0 flex-1">
        <p className="text-brand-text text-sm leading-snug">{title}</p>
        <p className={`text-[12px] mt-1 font-medium ${STATUS_TONE_CLASS[statusSummary.tone]}`}>
          {statusSummary.text}
        </p>
      </div>
      <div className="flex shrink-0 items-start gap-1.5">
        <span className="text-brand-gold text-[13px] tabular-nums pt-0.5">€{lineTotal.toFixed(2)}</span>
        <button
          type="button"
          onClick={onToggleExpand}
          aria-label={expanded ? collapseLabel : expandLabel}
          aria-expanded={expanded}
          className="w-8 h-8 rounded-lg text-brand-text-muted hover:text-brand-gold hover:bg-brand-gold/10 transition-colors flex items-center justify-center"
        >
          <ChevronIcon expanded={expanded} />
        </button>
      </div>
    </div>
  );
}
