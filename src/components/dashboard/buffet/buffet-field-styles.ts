/** Shared field styles for buffet settings tables. */
export const buffetFieldClass =
  'rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-colors';

export const buffetTimeFieldClass =
  'w-[4.75rem] shrink-0 rounded-lg bg-brand-bg border border-brand-border px-2.5 py-2 text-sm text-brand-text tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-colors';

export const buffetSelectClass =
  'w-full rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40';

/** Primary workspace card (matrix, lists). */
export const buffetPanelClass =
  'rounded-2xl border border-brand-border/80 bg-brand-card shadow-sm overflow-hidden';

export const buffetPanelToolbarClass =
  'flex flex-wrap items-center justify-between gap-x-5 gap-y-3 px-4 sm:px-5 py-3 border-b border-brand-border/60 bg-brand-bg/25';

export const buffetPanelBodyClass = 'p-4 sm:p-5';

/** Segmented matrix | list toggle — matches toolbar control height (h-9). */
export const buffetSegmentWrapClass =
  'inline-flex h-9 items-center rounded-lg border border-brand-border bg-brand-card p-0.5 text-[13px] shrink-0 shadow-sm';

export function buffetSegmentBtnClass(active: boolean): string {
  return `h-full px-3 rounded-md font-medium transition-colors whitespace-nowrap ${
    active
      ? 'bg-brand-bg text-brand-gold shadow-sm border border-brand-border/50'
      : 'text-brand-text hover:text-brand-gold border border-transparent'
  }`;
}

/** Desktop grid for one time-slot row (name · time · sort · weekdays · actions). */
export const buffetSlotRowGrid =
  'md:grid md:grid-cols-[minmax(0,9rem)_minmax(0,11rem)_3.25rem_minmax(0,1fr)_auto] md:gap-x-3 md:items-center';

export const buffetSlotHeaderGrid =
  'hidden md:grid md:grid-cols-[minmax(0,9rem)_minmax(0,11rem)_3.25rem_minmax(0,1fr)_auto] md:gap-x-3 px-3 text-[11px] font-medium text-brand-text-muted';
