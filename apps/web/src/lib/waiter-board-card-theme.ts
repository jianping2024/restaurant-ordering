import type { WaiterBoardFilter, WaiterTableBoardState } from '@/lib/waiter-board-session';

/** Visual tokens for one waiter board table card — keyed by business board state only. */
export type WaiterBoardCardTheme = {
  shell: string;
  title: string;
  badge: string;
  /** Shared row3 typography — duration (left) and amount (right) use the same size/weight. */
  row3: string;
  meta: string;
  durationAccent: string;
  amount: string;
  footer: string;
};

/** KPI filter chip tones — match table-card shell + title for the three board states. */
export type WaiterBoardKpiTone = 'amber' | 'emerald' | 'neutral' | 'rose';

export const WAITER_BOARD_KPI_TONE_CLASS: Record<WaiterBoardKpiTone, string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-800 shadow-sm',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm',
  rose: 'border-rose-200 bg-rose-50 text-rose-800 shadow-sm',
  /** 「全部」has no board-state card — keep brand neutral. */
  neutral: 'border-brand-border bg-brand-card text-brand-text shadow-sm',
};

export const WAITER_BOARD_FILTER_KPI_TONE: Record<WaiterBoardFilter, WaiterBoardKpiTone> = {
  all: 'neutral',
  checkout: 'amber',
  dining: 'rose',
  idle: 'emerald',
};

/** Shell without hover affordances — display-only board cards (e.g. waiter checkout). */
export function waiterBoardCardShellClass(
  boardState: WaiterTableBoardState,
  interactive: boolean,
): string {
  const shell = WAITER_BOARD_CARD_THEME[boardState].shell;
  if (interactive) return shell;
  return shell.replace(/\s*hover:\S+/g, '');
}

export function waiterBoardKpiToneClass(tone: WaiterBoardKpiTone): string {
  return WAITER_BOARD_KPI_TONE_CLASS[tone];
}

export const WAITER_BOARD_CARD_THEME: Record<WaiterTableBoardState, WaiterBoardCardTheme> = {
  dining: {
    shell:
      'border-rose-200 bg-rose-50 shadow-sm hover:border-rose-300 dark:border-rose-700/70 dark:bg-rose-950/40 dark:hover:border-rose-600',
    title: 'text-rose-800 dark:text-rose-100',
    badge:
      'border border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-700/60 dark:bg-rose-900/60 dark:text-rose-200',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-black',
    durationAccent: 'text-rose-700 dark:text-rose-300',
    amount: 'text-rose-800 dark:text-rose-100',
    footer:
      'border-rose-300 text-rose-700 hover:bg-rose-100/50 group-hover:border-rose-400 dark:text-rose-200 dark:hover:bg-rose-900/25',
  },
  checkout: {
    shell:
      'border-amber-200 bg-amber-50 shadow-sm hover:border-amber-300 dark:border-amber-700/70 dark:bg-amber-950/40 dark:hover:border-amber-600',
    title: 'text-amber-800 dark:text-amber-100',
    badge:
      'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/60 dark:text-amber-200',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-black',
    durationAccent: 'text-amber-700 dark:text-amber-300',
    amount: 'text-amber-800 dark:text-amber-100',
    footer:
      'border-amber-300 text-amber-700 hover:bg-amber-100/50 group-hover:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-900/25',
  },
  idle: {
    shell:
      'border-emerald-200 bg-emerald-50 shadow-sm hover:border-emerald-300 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:hover:border-emerald-600',
    title: 'text-emerald-800 dark:text-emerald-100',
    badge:
      'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/60 dark:text-emerald-200',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-black',
    durationAccent: '',
    amount: '',
    footer:
      'border-emerald-300 text-emerald-700 hover:bg-emerald-100/50 group-hover:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-900/25',
  },
};

/** Party "移出" chip — same fill/border as card shell; sits on the card top-right corner. */
export const WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS: Record<WaiterTableBoardState, string> = {
  dining:
    'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-700/70 dark:bg-rose-950/40 dark:text-rose-100',
  checkout:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700/70 dark:bg-amber-950/40 dark:text-amber-100',
  idle:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:text-emerald-100',
};
