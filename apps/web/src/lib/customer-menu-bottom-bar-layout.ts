/** Docked customer menu footer — shared height and scroll padding (MenuPage + CustomerMenuFooter). */

export const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS = 'h-14';

const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_REM = 3.5;

/** Fixed shell: flush to viewport bottom; safe area lives inside the bar. */
export const customerMenuBottomBarDockClass =
  'fixed bottom-0 left-1/2 z-30 w-full max-w-mobile -translate-x-1/2 border-t border-brand-border bg-brand-card shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-[max(0px,env(safe-area-inset-bottom))]';

export const customerMenuBottomBarRowClass = `flex ${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS} items-center justify-between gap-3 px-4`;

export const customerMenuBottomBarSummarySlotClass = 'flex min-w-0 flex-1 items-center';

export const customerMenuBottomBarActionSlotClass = 'shrink-0';

/** Icon + text block spacing (draft cart / ordered bag). */
export const customerMenuBottomBarIconGapClass = 'gap-4';

export const customerMenuBottomBarIconClass = 'h-8 w-8 shrink-0 text-brand-gold';

export const customerMenuBottomBarAmountLabelClass = 'text-sm text-brand-text-muted';

export const customerMenuBottomBarAmountValueClass =
  'font-heading text-lg font-semibold tabular-nums text-brand-text';

export const customerMenuBottomBarAmountRowClass = 'flex shrink-0 items-baseline gap-1';

export const customerMenuBottomBarOrderedCountClass =
  'truncate font-heading text-lg font-semibold text-brand-text';

export const customerMenuBottomBarPrimaryActionClass =
  'inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-[14px] font-semibold transition-colors bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98]';

export const customerMenuBottomBarDisabledActionClass =
  'inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 text-[14px] font-semibold pointer-events-none bg-brand-border/20 text-brand-text-muted';

/** Scroll padding so the last menu row clears the docked bar (+ safe area + small end cushion). */
export function customerMenuPageBottomPaddingClass(footerVisible: boolean): string {
  if (!footerVisible) return 'pb-16';
  return `pb-[calc(${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_REM}rem+env(safe-area-inset-bottom,0px)+0.5rem)]`;
}
