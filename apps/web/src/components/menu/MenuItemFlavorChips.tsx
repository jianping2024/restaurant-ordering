'use client';

import type { Language } from '@/types';
import { resolveMenuItemFlavorPresentation } from '@/lib/flavors';

/** List / under-name band — soft brand-gold chip (align allergen soft fill). */
export const MENU_ITEM_FLAVOR_CHIP_INLINE_CLASS =
  'inline-flex items-center rounded-full border border-brand-gold/35 bg-brand-gold/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand-gold-dark';

/** Detail hero corner — same gold language, card tint for photo contrast. */
export const MENU_ITEM_FLAVOR_CHIP_ON_IMAGE_CLASS =
  'inline-flex items-center rounded-full border border-brand-gold/40 bg-brand-card/92 px-2 py-0.5 text-[11px] font-semibold text-brand-gold-dark';

/**
 * Sole on-screen flavor hint chips for a menu item.
 * Caller must gate with `menu_flavor_hints_enabled` (pass enabled=false → render nothing).
 */
export function MenuItemFlavorChips({
  flavorCodes,
  lang,
  enabled,
  variant = 'inline',
  className = '',
}: {
  flavorCodes: unknown;
  lang: Language;
  enabled: boolean;
  variant?: 'inline' | 'onImage';
  className?: string;
}) {
  if (!enabled) return null;
  const chips = resolveMenuItemFlavorPresentation(flavorCodes, lang);
  if (chips.length === 0) return null;
  const chipClass =
    variant === 'onImage' ? MENU_ITEM_FLAVOR_CHIP_ON_IMAGE_CLASS : MENU_ITEM_FLAVOR_CHIP_INLINE_CLASS;
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`.trim()}>
      {chips.map((chip) => (
        <span key={chip.code} className={chipClass}>
          {chip.label}
        </span>
      ))}
    </span>
  );
}
