/** Longest board-card amount (6 digits incl. decimals) — drives row3 amount column width. */
export const WAITER_BOARD_CARD_MAX_AMOUNT_LABEL = '€9999.99';

/** Row2 layout — seat capacity with leading dual-person icon. */
export const WAITER_BOARD_CARD_ROW2_LAYOUT = {
  row: 'mt-1.5 flex min-h-[1rem] items-center justify-between gap-2 text-xs',
  capacity: 'flex min-w-0 items-center gap-1 truncate text-brand-text-muted',
  capacityIcon: 'h-3.5 w-3.5 shrink-0 text-brand-text-muted',
  guestCount: 'min-w-[2.75rem] shrink-0 text-right tabular-nums text-brand-text-muted',
} as const;

/** Row3 layout — baseline-align duration (left) and amount (right). */
export const WAITER_BOARD_CARD_ROW3_LAYOUT = {
  row: 'mt-2 flex min-h-[1.375rem] items-baseline justify-between gap-x-1.5',
  meta: 'min-w-0 flex-1 truncate',
  amount: 'shrink-0 whitespace-nowrap min-w-[4.5rem] text-right',
} as const;
