import type { WaiterBoardFilter, WaiterTableBoardState } from '@/lib/waiter-board-session';

/**
 * Board surface typography roles — one map for KPI / lanes / cards.
 * Colors stay brand-* (no ad-hoc sky palette); status color only via mesa-badge / shell.
 */
export const waiterBoardType = {
  pageTitle: 'font-heading text-2xl text-brand-gold mb-4',
  kpiCount: 'text-2xl font-semibold tabular-nums leading-none text-brand-text',
  kpiLabel: 'mt-1.5 text-sm font-medium text-brand-text',
  kpiHint: 'mt-0.5 text-sm text-brand-text-muted',
  laneLabel: 'max-w-[12rem] truncate text-sm font-medium',
  laneMeta: 'shrink-0 text-sm tabular-nums text-brand-text-muted',
  cardTitle:
    'min-w-0 flex-1 truncate text-left font-heading text-lg sm:text-[22px] font-bold leading-tight',
  cardRow3: 'text-sm font-semibold leading-none tabular-nums',
} as const;

/** Lane tabs +「创建同行组」— shared height; active = brand gold only. */
export const WAITER_BOARD_LANE_CHROME = {
  base: 'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 min-h-[2.75rem] transition-colors',
  idle: 'border-brand-border/70 bg-brand-card/40 text-brand-text-muted hover:border-brand-gold/35 hover:text-brand-text',
  active: 'border-brand-gold/55 bg-brand-gold/12 text-brand-gold shadow-sm',
} as const;

/** Selected together-group panel — brand chrome, not a second accent palette. */
export const WAITER_BOARD_PARTY_PANEL_CLASS =
  'rounded-2xl border-2 border-brand-gold/40 bg-brand-card p-4 shadow-sm';

/** Visual tokens for one waiter board table card — keyed by business board state only. */
export type WaiterBoardCardTheme = {
  title: string;
  badge: string;
  /** Shared row3 typography — duration (left) and amount (right) use the same size/weight. */
  row3: string;
  meta: string;
  durationAccent: string;
  amount: string;
  footer: string;
};

/**
 * KPI filter chip tones — map to the same status badges as board shells
 * (warning=checkout, danger=dining, success=idle).
 */
export type WaiterBoardKpiTone = 'amber' | 'emerald' | 'neutral' | 'rose';

export const WAITER_BOARD_KPI_TONE_CLASS: Record<WaiterBoardKpiTone, string> = {
  amber: 'mesa-badge-warning shadow-sm',
  emerald: 'mesa-badge-success shadow-sm',
  rose: 'mesa-badge-danger shadow-sm',
  /** 「全部」has no board-state card — keep brand neutral. */
  neutral: 'border border-brand-border bg-brand-card text-brand-text shadow-sm',
};

export const WAITER_BOARD_FILTER_KPI_TONE: Record<WaiterBoardFilter, WaiterBoardKpiTone> = {
  all: 'neutral',
  checkout: 'amber',
  dining: 'rose',
  idle: 'emerald',
};

const BOARD_SHELL: Record<WaiterTableBoardState, string> = {
  dining: 'mesa-board-shell-dining shadow-sm',
  checkout: 'mesa-board-shell-checkout shadow-sm',
  idle: 'mesa-board-shell-idle shadow-sm',
};

/** Shell class for board cards (hover is CSS on a/button — no media `dark:`). */
export function waiterBoardCardShellClass(
  boardState: WaiterTableBoardState,
  interactive: boolean,
): string {
  void interactive;
  return BOARD_SHELL[boardState];
}

export function waiterBoardKpiToneClass(tone: WaiterBoardKpiTone): string {
  return WAITER_BOARD_KPI_TONE_CLASS[tone];
}

/** Body copy on board cards — always high-contrast brand-text (never gray / tint-on-tint). */
const BOARD_COPY = 'text-brand-text';

export const WAITER_BOARD_CARD_THEME: Record<WaiterTableBoardState, WaiterBoardCardTheme> = {
  dining: {
    title: BOARD_COPY,
    badge: 'mesa-badge-danger',
    row3: waiterBoardType.cardRow3,
    meta: BOARD_COPY,
    durationAccent: BOARD_COPY,
    amount: BOARD_COPY,
    footer: 'mesa-board-footer-dining',
  },
  checkout: {
    title: BOARD_COPY,
    badge: 'mesa-badge-warning',
    row3: waiterBoardType.cardRow3,
    meta: BOARD_COPY,
    durationAccent: BOARD_COPY,
    amount: BOARD_COPY,
    footer: 'mesa-board-footer-checkout',
  },
  idle: {
    title: BOARD_COPY,
    badge: 'mesa-badge-success',
    row3: waiterBoardType.cardRow3,
    meta: BOARD_COPY,
    durationAccent: '',
    amount: '',
    footer: 'mesa-board-footer-idle',
  },
};

/** Party "移出" chip — same status badge family as the card shell. */
export const WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS: Record<WaiterTableBoardState, string> = {
  dining: 'mesa-badge-danger',
  checkout: 'mesa-badge-warning',
  idle: 'mesa-badge-success',
};
