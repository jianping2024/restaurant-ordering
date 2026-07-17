import type { WaiterBoardFilter, WaiterTableBoardState } from '@/lib/waiter-board-session';

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
    row3: 'text-sm font-semibold leading-none tabular-nums',
    meta: BOARD_COPY,
    durationAccent: BOARD_COPY,
    amount: BOARD_COPY,
    footer: 'mesa-board-footer-dining',
  },
  checkout: {
    title: BOARD_COPY,
    badge: 'mesa-badge-warning',
    row3: 'text-sm font-semibold leading-none tabular-nums',
    meta: BOARD_COPY,
    durationAccent: BOARD_COPY,
    amount: BOARD_COPY,
    footer: 'mesa-board-footer-checkout',
  },
  idle: {
    title: BOARD_COPY,
    badge: 'mesa-badge-success',
    row3: 'text-sm font-semibold leading-none tabular-nums',
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
