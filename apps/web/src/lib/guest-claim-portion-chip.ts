/**
 * Sole guest by-item claim portion chrome (`GuestClaimDishCard`).
 * Add chips (`+1` / `+1/n` / `+1 成人` / `+1 儿童`) = soft press relief
 * (same token as `Button` outline/soft + staff pool CTAs).
 * Minus circle = compact (same token as selection chips / trash).
 * Do not restyle shadow / active translate at the card call site.
 */

import {
  buttonPressReliefCompactClass,
  buttonPressReliefSoftClass,
} from '@/components/ui/button-press-relief';

/** Sole add-portion chip (grid cell; label length may vary). */
export const GUEST_CLAIM_PORTION_CHIP_CLASS =
  `h-11 rounded-xl border border-brand-border bg-brand-bg/60 px-1 flex items-center justify-center gap-1 text-base font-semibold leading-none tabular-nums whitespace-nowrap text-brand-gold transition-all duration-200 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent disabled:text-brand-text-muted/50 disabled:shadow-none ${buttonPressReliefSoftClass}` as const;

/** Sole minus control on a claimed dish footer. */
export const GUEST_CLAIM_PORTION_MINUS_CLASS =
  `w-10 h-10 shrink-0 rounded-full border border-brand-border bg-brand-card text-brand-text flex items-center justify-center text-xl leading-none transition-all duration-200 disabled:opacity-40 disabled:shadow-none ${buttonPressReliefCompactClass}` as const;
