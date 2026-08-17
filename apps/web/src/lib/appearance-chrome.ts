/** Sole chrome button class for theme + language (auth, ordering, settings). */
export function appearanceChromeButtonClass(variant: 'icon' | 'label' = 'icon'): string {
  // min 44×44 — matches docs/design/04-mobile-rules.md touch target.
  // Ghost: no fill/border so header paint stays light; hit area stays h-11.
  const shared =
    'inline-flex min-h-11 shrink-0 items-center justify-center text-sm text-brand-text-muted transition-colors hover:text-brand-text';
  if (variant === 'label') {
    return `${shared} h-11 gap-0.5 rounded-full px-2.5 font-medium`;
  }
  return `${shared} h-11 w-11 rounded-full`;
}
