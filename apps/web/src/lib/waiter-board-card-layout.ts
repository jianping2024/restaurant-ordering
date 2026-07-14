/** Longest board-card amount (6 digits incl. decimals) — drives row3 amount column width on sm+. */
export const WAITER_BOARD_CARD_MAX_AMOUNT_LABEL = '€9999.99';

/** Grouped table sections — md+ column counts match pre-mobile-UX refactor. */
export const WAITER_BOARD_TABLES_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3';

/** Pinned checkout strip — one fewer column per breakpoint than grouped tables. */
export const WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

/** Row1 layout — table title scales down on narrow viewports. */
export const WAITER_BOARD_CARD_ROW1_LAYOUT = {
  title: 'min-w-0 truncate text-lg sm:text-[22px] font-bold leading-tight',
  statusGroup: 'flex min-w-0 max-w-[55%] shrink items-center justify-end gap-1',
  opener:
    'min-w-0 max-w-[4.5rem] truncate rounded-full px-2 py-0.5 text-xs font-medium',
} as const;

/** Row2 layout — seat capacity with leading dual-person icon. */
export const WAITER_BOARD_CARD_ROW2_LAYOUT = {
  row: 'mt-1.5 flex min-h-[1rem] items-center justify-between gap-2 text-xs',
  capacity: 'flex min-w-0 items-center gap-1 truncate text-brand-text-muted',
  capacityIcon: 'h-3.5 w-3.5 shrink-0 text-brand-text-muted',
  guestCount: 'min-w-[2.75rem] shrink-0 text-right tabular-nums text-brand-text-muted',
} as const;

/** Row3 layout — duration (left) and amount (right) on one row at all breakpoints. */
export const WAITER_BOARD_CARD_ROW3_LAYOUT = {
  row: 'mt-2 flex min-h-[1.375rem] items-baseline justify-between gap-x-1.5',
  meta: 'min-w-0 flex-1 truncate',
  amount: 'shrink-0 whitespace-nowrap min-w-[4.5rem] text-right',
} as const;
