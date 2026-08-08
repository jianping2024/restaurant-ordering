import { WAITER_BOARD_LANE_TO_CARD_CLEARANCE } from './waiter-board-card-theme';

/** Longest board-card amount (6 digits incl. decimals) — drives amount column width on sm+. */
export const WAITER_BOARD_CARD_MAX_AMOUNT_LABEL = '€9999.99';

/** Shared column breakpoints for board card grids (1 → 2 → 3). */
const WAITER_BOARD_CARD_GRID_COLS =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';

/**
 * Floor / party card grids under the sticky lane — columns + sole lane scroll-margin
 * (`WAITER_BOARD_LANE_TO_CARD_CLEARANCE.gridScrollMargin`).
 */
export const WAITER_BOARD_TABLES_GRID_CLASS = [
  WAITER_BOARD_CARD_GRID_COLS,
  WAITER_BOARD_LANE_TO_CARD_CLEARANCE.gridScrollMargin,
].join(' ');

/**
 * Checkout pinned strip above the sticky lane — same columns, no lane scroll-margin.
 */
export const WAITER_BOARD_CHECKOUT_PINNED_GRID_CLASS = WAITER_BOARD_CARD_GRID_COLS;
