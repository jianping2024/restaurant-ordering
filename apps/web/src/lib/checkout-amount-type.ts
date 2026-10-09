/**
 * Sole checkout *action money* face — queue-card pending, by-item ticket estimate,
 * person collect-now beside 收款. Not SettlementBar pending (sm inherit), not line-share meta.
 */
export const CHECKOUT_ACTION_AMOUNT_CLASS =
  'text-brand-gold font-semibold text-lg tabular-nums' as const;

/**
 * Sole staff「收款」CTA width beside action amount — ~2× content-sized `size="action"` (px-5).
 * Do not widen global `Button` action; only these collect call sites.
 */
export const CHECKOUT_COLLECT_BUTTON_CLASS = 'min-w-[9.125rem]' as const;
