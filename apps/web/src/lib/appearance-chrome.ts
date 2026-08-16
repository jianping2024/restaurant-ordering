/** Sole circular icon-button chrome for theme + language controls (auth, ordering, settings). */
export function appearanceChromeIconButtonClass(): string {
  // 44×44 — matches docs/design/04-mobile-rules.md touch target.
  return 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-bg text-sm text-brand-text-muted transition-colors hover:border-brand-gold/40 hover:text-brand-text';
}
