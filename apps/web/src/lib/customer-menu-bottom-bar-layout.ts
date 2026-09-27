import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from '@/lib/customer-menu-chrome-layout';
import { CUSTOMER_MENU_TYPE } from '@/lib/customer-menu-type';

/** Docked customer menu footer — layout and scroll padding (MenuPage + CustomerMenuFooter). */

export const CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS = 'h-14';

/**
 * Sole bottom inset pad inside the flush dock / sheets / detail footers.
 * Formula once in `globals.css` as `--mesa-customer-menu-bottom-safe`
 * (`env(safe-area-inset-bottom)` only — home indicator; zero when absent so the CTA row stays optically centered).
 * Requires root `viewport.viewportFit: 'cover'`.
 */
export const CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS =
  'pb-[var(--mesa-customer-menu-bottom-safe)]';

/**
 * Scroll padding when the docked footer is visible.
 * Bar row + bottom inset + end cushion. Static string for Tailwind JIT.
 */
export const CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER =
  'pb-[calc(3.5rem+var(--mesa-customer-menu-bottom-safe)+0.5rem)]';

/**
 * Flush dock: `bottom-0` so the bar sticks to the screen bottom (opaque, no gap for menu to show through).
 * Interactive row sits above {@link CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS} (browser chrome clearance).
 */
export const customerMenuBottomBarDockClass = [
  'fixed bottom-0 left-1/2 z-30 -translate-x-1/2',
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  'border-t border-brand-border bg-brand-card shadow-[0_-4px_24px_rgba(0,0,0,0.08)]',
  CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
].join(' ');

export const customerMenuBottomBarRowClass = `flex ${CUSTOMER_MENU_BOTTOM_BAR_HEIGHT_CLASS} items-center justify-between gap-3 px-4`;

export const customerMenuBottomBarSummarySlotClass = 'flex min-w-0 flex-1 items-center';

export const customerMenuBottomBarActionSlotClass = 'shrink-0';

/** Icon + text block spacing (draft cart / ordered bag). */
export const customerMenuBottomBarIconGapClass = 'gap-4';

export const customerMenuBottomBarIconClass = 'h-8 w-8 shrink-0 text-brand-ink';

/** Sole qty badge chip on footer icons (cart / ordered / round). */
export const customerMenuBottomBarCountBadgeClass =
  'absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-gold px-1 text-[10px] font-bold leading-none text-brand-on-gold';

/**
 * Sole footer badge count label — caps at 99+ so long counts never stretch the bar.
 */
export function formatCustomerMenuFooterBadgeCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

const customerMenuBottomBarPrimaryActionBaseClass =
  `inline-flex h-10 shrink-0 items-center justify-center rounded-lg px-4 ${CUSTOMER_MENU_TYPE.footerPrimaryAction}`;

export const customerMenuBottomBarPrimaryActionClass =
  `${customerMenuBottomBarPrimaryActionBaseClass} transition-colors bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light active:scale-[0.98]`;

export const customerMenuBottomBarDisabledActionClass =
  `${customerMenuBottomBarPrimaryActionBaseClass} pointer-events-none bg-brand-border/20 text-brand-text-muted`;

/** Scroll padding so the last menu row clears the docked bar (+ inset + cushion). */
export function customerMenuPageBottomPaddingClass(footerVisible: boolean): string {
  if (!footerVisible) return 'pb-16';
  return CUSTOMER_MENU_PAGE_BOTTOM_PADDING_WITH_FOOTER;
}
