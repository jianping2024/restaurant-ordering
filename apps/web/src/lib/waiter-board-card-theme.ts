import type { WaiterBoardFilter, WaiterTableBoardState } from '@/lib/waiter-board-session';
import { waiterStaffStickyChrome } from '@/lib/waiter-staff-sticky-chrome';

/**
 * Board surface typography roles — one map for KPI / lanes / cards.
 * Font stacks: heading=display (Cormorant+Noto Serif SC), body default, money=.mesa-money,
 * statusVertical=.mesa-status-vertical (Noto Serif SC only). Colors = brand-* / status tokens.
 */
export const waiterBoardType = {
  pageTitle: 'font-heading text-2xl text-brand-ink mb-4',
  kpiCount: 'font-heading text-2xl font-semibold tabular-nums leading-none',
  kpiLabel: 'text-sm font-medium',
  laneLabel: 'max-w-[12rem] truncate text-sm',
  laneMeta: 'shrink-0 text-sm tabular-nums opacity-80',
  cardTitle:
    'min-w-0 truncate text-left font-heading text-lg font-bold leading-tight',
  /** Opener beside table title — not a meta chip. */
  cardOpener:
    'max-w-[4.5rem] truncate text-xs font-medium text-brand-text opacity-85',
  /** Sole gold title-row pill (拼桌 / 转桌 · 人头). */
  cardBadge:
    'shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium text-brand-gold border border-brand-gold/50',
  cardMeta: 'mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-brand-text',
  /**
   * Sole floor-card amount face — money stack + brand ink.
   * Dense 6-col: ~22px so amount fits without overlapping CTA.
   * Height lives only on `cardAmountSlot` — this face must fit inside that box.
   */
  cardAmount: 'mesa-money text-[22px] !font-semibold leading-none text-brand-ink',
  /** Idle hint in the same below-rule slot as amount (mutually exclusive). */
  cardIdleHint: 'truncate text-xs leading-snug text-brand-text',
  /**
   * Sole amount-row height (amount, idle hint, or empty). Fixed `h-7` matches
   * mesa-money 22px line box; never a smaller min-h that dining overflows and
   * idle collapses (grid row stretch → card 伸缩).
   */
  cardAmountSlot: 'inline-flex h-7 min-w-0 items-center',
  cardCta: 'shrink-0 text-[0.8125rem] font-semibold',
  /** Glyph stack lives in globals `.mesa-status-vertical` (sole statusVertical face). */
  cardStatus: 'mesa-status-vertical',
} as const;

/**
 * Shared selected face — lane selected (KPI uses fine-line rules, not this fill).
 * Solid azulejo ink + on-ink text.
 */
export const WAITER_BOARD_SELECTED_EMPHASIS =
  'border border-brand-ink bg-brand-ink text-brand-on-ink shadow-sm';

/**
 * Lane tabs + together-group dropdown — shared geometry (height + font-weight);
 * active = solid ink face only (colors), never a second weight that reflows width.
 */
export const WAITER_BOARD_LANE_CHROME = {
  base: 'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[2.75rem] font-semibold transition-colors',
  idle: 'border border-brand-border/70 bg-brand-card/40 text-brand-text-muted hover:border-brand-ink/35 hover:text-brand-text',
  active: WAITER_BOARD_SELECTED_EMPHASIS,
} as const;

/**
 * Sole lane→card clearance under the sticky dock (one spacing step, two faces).
 * - `shellPadBottom` — interior pad on the sticky shell (in opaque paint; never exterior `mb`)
 * - `gridScrollMargin` — matching `scroll-margin-top` on below-lane card grids only
 * Sized to clear `mesa-scroll-frame` double-frame top when the dock is stuck.
 */
export const WAITER_BOARD_LANE_TO_CARD_CLEARANCE = {
  shellPadBottom: 'pb-8',
  gridScrollMargin: 'scroll-mt-8',
} as const;

/**
 * Board lane tablist shell — sticks under staff top bar while the grid scrolls.
 * Opaque page bg paints the full dock (tabs + lane→card clearance) so cards never
 * show through a transparent margin gap; offset = `waiterStaffStickyChrome`.
 * Spacing before the grid is shell padding-bottom only — not exterior margin.
 */
export const WAITER_BOARD_LANE_STICKY_SHELL =
  `sticky ${waiterStaffStickyChrome.belowStaffTopBar} z-20 min-w-0 border-b border-brand-border/40 bg-brand-bg pt-2 ${WAITER_BOARD_LANE_TO_CARD_CLEARANCE.shellPadBottom}`;

/**
 * Sole trailing scroll room for the sticky lane dock — enough that max-scroll can
 * park table cards fully below the opaque dock (no second spacer at call sites).
 */
export const WAITER_BOARD_LANE_STICKY_SCROLL_CLEARANCE = 'pb-24';

/** Selected together-group panel — brand chrome, not a second accent palette. */
export const WAITER_BOARD_PARTY_PANEL_CLASS =
  'rounded-2xl border-2 border-brand-ink/40 bg-brand-card p-4 shadow-sm';

/** Visual tokens for one waiter board table card — keyed by business board state only. */
export type WaiterBoardCardTheme = {
  title: string;
  cta: string;
};

/** Sole KPI strip layout (mockup `grid-cols-2 sm:grid-cols-4 gap-4`). */
export const WAITER_BOARD_KPI_GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-4 gap-4';

/** Active KPI underline — always gold (mockup selected rule). */
export const WAITER_BOARD_KPI_RULE_ACTIVE_CLASS = 'bg-brand-gold';

/** Fine-line KPI rule + count colors (mockup stats — not solid chips). */
export const WAITER_BOARD_KPI_RULE_CLASS: Record<WaiterBoardFilter, string> = {
  all: 'bg-brand-gold',
  checkout: 'bg-[rgb(var(--color-status-warning-border))]',
  dining: 'bg-[rgb(var(--color-status-danger-border))]',
  idle: 'bg-[rgb(var(--color-status-success-border))]',
};

export const WAITER_BOARD_KPI_COUNT_CLASS: Record<WaiterBoardFilter, string> = {
  all: 'text-brand-text',
  checkout: 'mesa-text-warning',
  dining: 'mesa-text-danger',
  idle: 'mesa-text-success',
};

export const WAITER_BOARD_KPI_LABEL_CLASS: Record<WaiterBoardFilter, string> = {
  all: 'text-brand-ink',
  checkout: 'text-brand-text',
  dining: 'text-brand-text',
  idle: 'text-brand-text',
};

/** Scroll-frame status modifiers — one shell language with the mockup. */
const BOARD_SHELL: Record<WaiterTableBoardState, string> = {
  dining: 'mesa-scroll-frame is-dining',
  checkout: 'mesa-scroll-frame is-pending',
  idle: 'mesa-scroll-frame is-free',
};

/** Shell class for board cards (hover is CSS on a/button — no media `dark:`). */
export function waiterBoardCardShellClass(
  boardState: WaiterTableBoardState,
  interactive: boolean,
): string {
  void interactive;
  return BOARD_SHELL[boardState];
}

const BOARD_COPY = 'text-brand-text';

export const WAITER_BOARD_CARD_THEME: Record<WaiterTableBoardState, WaiterBoardCardTheme> = {
  dining: {
    title: BOARD_COPY,
    cta: 'text-brand-ink',
  },
  checkout: {
    title: BOARD_COPY,
    cta: 'mesa-text-warning font-bold',
  },
  idle: {
    title: BOARD_COPY,
    cta: 'mesa-text-success',
  },
};

/** Party "移出" chip — same status badge family as the card shell. */
export const WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS: Record<WaiterTableBoardState, string> = {
  dining: 'mesa-badge-danger',
  checkout: 'mesa-badge-warning',
  idle: 'mesa-badge-success',
};
