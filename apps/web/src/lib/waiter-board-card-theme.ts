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
  /** Soft tile so KPI glyphs read as decoration, not hairline corner marks. */
  kpiIconWrap:
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-text/[0.1]',
  kpiIcon: 'h-6 w-6 text-brand-text',
  /** Color/weight inherit from lane chrome (idle muted / active gold). */
  laneLabel: 'max-w-[12rem] truncate text-sm',
  laneMeta: 'shrink-0 text-sm tabular-nums opacity-80',
  cardTitle:
    'min-w-0 flex-1 truncate text-left font-heading text-lg sm:text-[22px] font-bold leading-tight',
  cardRow3: 'text-sm font-semibold leading-none tabular-nums',
} as const;

/**
 * Shared selected emphasis — KPI pressed + lane selected (brand gold only).
 * One representation for “this control is active.”
 */
export const WAITER_BOARD_SELECTED_EMPHASIS =
  'ring-2 ring-brand-gold ring-offset-2 ring-offset-brand-bg shadow-md';

/** Lane tabs +「创建同行组」— shared height; active uses stronger gold + selected ring. */
export const WAITER_BOARD_LANE_CHROME = {
  base: 'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 min-h-[2.75rem] transition-colors',
  idle: 'border border-brand-border/70 bg-brand-card/40 text-brand-text-muted font-medium hover:border-brand-gold/35 hover:text-brand-text',
  active: `border-2 border-brand-gold bg-brand-gold/18 text-brand-gold font-semibold ${WAITER_BOARD_SELECTED_EMPHASIS}`,
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

/**
 * Board KPI glyphs — one key per filter, drawn for floor semantics
 * (grid / bill / dining / vacant), not reused action-bar silhouettes.
 */
export type WaiterBoardKpiIconKey = 'floor' | 'bill' | 'dining' | 'vacant';

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

export const WAITER_BOARD_FILTER_KPI_ICON: Record<WaiterBoardFilter, WaiterBoardKpiIconKey> = {
  all: 'floor',
  checkout: 'bill',
  dining: 'dining',
  idle: 'vacant',
};

export function waiterBoardKpiChromeClass(active: boolean): string {
  return active ? WAITER_BOARD_SELECTED_EMPHASIS : '';
}

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
