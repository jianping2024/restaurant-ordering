/** Longest board-card amount (6 digits incl. decimals) — drives row3 amount column width on sm+. */
export const WAITER_BOARD_CARD_MAX_AMOUNT_LABEL = '€9999.99';

/** Shared responsive grid for waiter board sections (pinned checkout + grouped tables). */
export const WAITER_BOARD_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3';

/** Row1 layout — table title scales down on narrow viewports. */
export const WAITER_BOARD_CARD_ROW1_LAYOUT = {
  title: 'min-w-0 truncate text-lg sm:text-[22px] font-bold leading-tight',
} as const;

/** Row2 layout — seat capacity with leading dual-person icon. */
export const WAITER_BOARD_CARD_ROW2_LAYOUT = {
  row: 'mt-1.5 flex min-h-[1rem] items-center justify-between gap-2 text-xs',
  capacity: 'flex min-w-0 items-center gap-1 truncate text-brand-text-muted',
  capacityIcon: 'h-3.5 w-3.5 shrink-0 text-brand-text-muted',
  guestCount: 'min-w-[2.75rem] shrink-0 text-right tabular-nums text-brand-text-muted',
} as const;

/** Row3 layout — stack duration/amount on mobile; side-by-side from sm+. */
export const WAITER_BOARD_CARD_ROW3_LAYOUT = {
  row: 'mt-2 flex min-h-[1.375rem] flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-1.5',
  meta: 'min-w-0 w-full sm:flex-1 sm:truncate',
  amount: 'shrink-0 whitespace-nowrap sm:min-w-[4.5rem] sm:text-right',
} as const;
