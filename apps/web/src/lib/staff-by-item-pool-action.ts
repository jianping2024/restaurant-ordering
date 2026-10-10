/**
 * Sole staff by-item **pool** action chrome (left rail: 1A / 1C / 1/{den}份 / 1份).
 * Fixed D size 96×48 — do not size from label length; short labels stay centered.
 */

const STAFF_BY_ITEM_POOL_ACTION_SHELL_CLASS =
  'inline-flex h-12 w-24 shrink-0 items-center justify-center gap-1 rounded-xl border text-[15px] font-bold leading-none disabled:opacity-40' as const;

/** Sole primary pool CTA (1A / 1份). */
export const STAFF_BY_ITEM_POOL_ACTION_PRIMARY_CLASS =
  `${STAFF_BY_ITEM_POOL_ACTION_SHELL_CLASS} border-brand-gold/40 bg-brand-gold/10 text-brand-gold` as const;

/** Sole ghost pool CTA (1C / 1/{den}份). */
export const STAFF_BY_ITEM_POOL_ACTION_GHOST_CLASS =
  `${STAFF_BY_ITEM_POOL_ACTION_SHELL_CLASS} border-brand-border bg-brand-card text-brand-text` as const;
