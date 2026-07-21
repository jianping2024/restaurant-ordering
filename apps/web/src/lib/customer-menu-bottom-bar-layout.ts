import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

/** Docked customer menu footer — layout and scroll padding (MenuPage + CustomerMenuFooter). */

export const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS = 'h-14';

/**
 * Scroll padding when the docked footer is visible.
 * Must be a full static string so Tailwind JIT emits the class (no JS interpolation).
 * `3.5rem` matches `CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS` (`h-14`).
 */
export const CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER =
  'pb-[calc(3.5rem+env(safe-area-inset-bottom,0px)+0.5rem)]';

/** Fixed shell: flush to viewport bottom; safe area lives inside the bar. */
export const customerMenuBottomBarDockClass =
  'fixed bottom-0 left-1/2 z-30 w-full max-w-mobile -translate-x-1/2 border-t border-brand-border bg-brand-card shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-[max(0px,env(safe-area-inset-bottom))]';

export const customerMenuBottomBarRowClass = `flex ${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS} items-center justify-between gap-3 px-4`;

export const customerMenuBottomBarSummarySlotClass = 'flex min-w-0 flex-1 items-center';

export const customerMenuBottomBarActionSlotClass = 'shrink-0';

/** Icon + text block spacing (draft cart / ordered bag). */
export const customerMenuBottomBarIconGapClass = 'gap-4';

export const customerMenuBottomBarIconClass = 'h-8 w-8 shrink-0 text-brand-gold';

const customerMenuBottomBarPrimaryActionBaseClass =
  `inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 ${CUSTOMER_MENU_TYPE.footerPrimaryAction}`;

export const customerMenuBottomBarPrimaryActionClass =
  `${customerMenuBottomBarPrimaryActionBaseClass} transition-colors bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98]`;

export const customerMenuBottomBarDisabledActionClass =
  `${customerMenuBottomBarPrimaryActionBaseClass} pointer-events-none bg-brand-border/20 text-brand-text-muted`;

/** Scroll padding so the last menu row clears the docked bar (+ safe area + small end cushion). */
export function customerMenuPageBottomPaddingClass(footerVisible: boolean): string {
  if (!footerVisible) return 'pb-16';
  return CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER;
}
