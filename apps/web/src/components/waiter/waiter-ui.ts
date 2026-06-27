/** Shared waiter surface styles (cards, nav links). Action buttons use `@/components/ui/Button`. */
export const waiterUi = {
  cardSurface:
    'rounded-2xl border border-brand-border/50 bg-brand-card shadow-sm shadow-black/5',
  navLink:
    'inline-flex border-0 no-underline text-[13px] rounded-lg px-3 py-1.5 text-brand-text-muted bg-brand-border/25 hover:bg-brand-border/45 hover:text-brand-text transition-colors focus-visible:ring-2 focus-visible:ring-brand-gold/30',
} as const;
