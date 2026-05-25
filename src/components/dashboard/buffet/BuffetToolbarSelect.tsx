'use client';

import type { SelectHTMLAttributes } from 'react';

/** Compact toolbar select — label sits beside, not stacked above. */
export const buffetToolbarSelectClass =
  'h-9 min-w-[10.5rem] max-w-[16rem] w-auto pl-3 pr-9 text-[13px] leading-none rounded-lg border border-brand-border bg-brand-card text-brand-text appearance-none cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/35 focus:border-brand-gold/40 transition-colors';

export const buffetToolbarChipClass =
  'inline-flex items-center h-9 max-w-[16rem] px-3 rounded-lg border border-brand-border/70 bg-brand-bg/40 text-[13px] font-medium text-brand-text truncate';

type BuffetToolbarSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function BuffetToolbarSelect({ className = '', children, ...props }: BuffetToolbarSelectProps) {
  return (
    <div className="relative inline-flex shrink-0">
      <select className={`${buffetToolbarSelectClass} ${className}`.trim()} {...props}>
        {children}
      </select>
      <span
        className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-brand-text-muted"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-70">
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}
