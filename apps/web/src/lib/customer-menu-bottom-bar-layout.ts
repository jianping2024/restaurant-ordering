/** Docked customer menu footer — shared height and scroll padding (MenuPage + CustomerMenuFooter). */

export const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS = 'h-14';

const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_REM = 3.5;

/** Fixed shell: flush to viewport bottom; safe area lives inside the bar. */
export const customerMenuBottomBarDockClass =
  'fixed bottom-0 left-1/2 z-30 w-full max-w-mobile -translate-x-1/2 border-t border-brand-border bg-brand-card shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-[max(0px,env(safe-area-inset-bottom))]';

export const customerMenuBottomBarRowClass = `flex ${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS} items-center gap-3 px-4`;

/** Scroll padding so the last menu row clears the docked bar (+ safe area + small end cushion). */
export function customerMenuPageBottomPaddingClass(footerVisible: boolean): string {
  if (!footerVisible) return 'pb-16';
  return `pb-[calc(${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_REM}rem+env(safe-area-inset-bottom,0px)+0.5rem)]`;
}
