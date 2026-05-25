/** Shared field styles for buffet settings tables. */
export const buffetFieldClass =
  'rounded-lg bg-brand-bg border border-brand-border px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-colors';

export const buffetTimeFieldClass =
  'w-[4.75rem] shrink-0 rounded-lg bg-brand-bg border border-brand-border px-2.5 py-2 text-sm text-brand-text tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-gold/40 transition-colors';

/** Desktop grid for one time-slot row (name · time · sort · weekdays · actions). */
export const buffetSlotRowGrid =
  'md:grid md:grid-cols-[minmax(0,9rem)_minmax(0,11rem)_3.25rem_minmax(0,1fr)_auto] md:gap-x-3 md:items-center';

export const buffetSlotHeaderGrid =
  'hidden md:grid md:grid-cols-[minmax(0,9rem)_minmax(0,11rem)_3.25rem_minmax(0,1fr)_auto] md:gap-x-3 px-3 text-[11px] font-medium text-brand-text-muted';
