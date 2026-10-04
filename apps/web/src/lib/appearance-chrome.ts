/**
 * Sole chrome button class for theme + language (auth, ordering, settings).
 * - `icon`: standalone ghost 44×44 (landing nav, personal settings rows).
 * - `segment`: one half of {@link appearanceChromeGroupClass}; the 44px hit area
 *   overflows the 36px capsule vertically so the pair reads as one control.
 */
export function appearanceChromeButtonClass(variant: 'icon' | 'segment' = 'icon'): string {
  // min 44×44 — matches docs/design/04-mobile-rules.md touch target.
  const shared =
    'inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-brand-text-muted transition-colors hover:text-brand-text';
  if (variant === 'segment') {
    return `${shared} gap-1 px-2.5 text-xs font-semibold leading-none`;
  }
  return `${shared} w-11 text-sm`;
}

/** Sole capsule shell around the language + theme segments (customer header, auth). */
export const appearanceChromeGroupClass =
  'inline-flex h-9 shrink-0 items-center rounded-full border border-brand-border bg-brand-card';

/** Hairline between the two capsule segments. */
export const appearanceChromeGroupDividerClass = 'h-4 w-px shrink-0 bg-brand-border';

/** Line glyph size inside appearance chrome (segment vs standalone icon). */
export function appearanceChromeGlyphClass(variant: 'icon' | 'segment' = 'icon'): string {
  return variant === 'segment' ? 'h-4 w-4 shrink-0' : 'h-5 w-5 shrink-0';
}
