import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

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

export const WAITER_BOARD_CARD_THEME: Record<WaiterTableBoardState, WaiterBoardCardTheme> = {
  dining: {
    shell:
      'border-emerald-200 bg-emerald-50 shadow-sm hover:border-emerald-300 dark:border-emerald-700/70 dark:bg-emerald-950/40 dark:hover:border-emerald-600',
    title: 'text-emerald-800 dark:text-emerald-100',
    badge:
      'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/60 dark:text-emerald-200',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-brand-text-muted',
    durationAccent: 'text-emerald-700 dark:text-emerald-300',
    amount: 'text-emerald-800 dark:text-emerald-100',
    footer:
      'border-emerald-300 text-emerald-700 hover:bg-emerald-100/50 group-hover:border-emerald-400 dark:text-emerald-200 dark:hover:bg-emerald-900/25',
  },
  checkout: {
    shell:
      'border-amber-200 bg-amber-50 shadow-sm hover:border-amber-300 dark:border-amber-700/70 dark:bg-amber-950/40 dark:hover:border-amber-600',
    title: 'text-amber-800 dark:text-amber-100',
    badge:
      'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/60 dark:text-amber-200',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-brand-text-muted',
    durationAccent: 'text-amber-700 dark:text-amber-300',
    amount: 'text-amber-800 dark:text-amber-100',
    footer:
      'border-amber-300 text-amber-700 hover:bg-amber-100/50 group-hover:border-amber-400 dark:text-amber-200 dark:hover:bg-amber-900/25',
  },
  idle: {
    shell:
      'border-neutral-200 bg-brand-card shadow-sm hover:border-neutral-300 dark:border-brand-border dark:hover:border-neutral-500',
    title: 'text-neutral-700 dark:text-brand-text',
    badge:
      'border border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-brand-border dark:bg-brand-border dark:text-brand-text-muted',
    row3: 'text-sm font-medium leading-none tabular-nums',
    meta: 'text-brand-text-muted',
    durationAccent: '',
    amount: '',
    footer:
      'border-neutral-300 text-neutral-600 hover:bg-neutral-100/70 group-hover:border-neutral-400 dark:text-brand-text-muted dark:hover:bg-brand-border/30',
  },
};
