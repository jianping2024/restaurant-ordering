import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from '@/lib/customer-menu-chrome-layout';

/**
 * Sole layout tokens for the customer menu item fullscreen detail
 * (`CustomerMenuItemDetailSheet`).
 */

/** Above cart/round drawers (z-40) and footer dock (z-30). */
export const CUSTOMER_MENU_ITEM_DETAIL_Z_CLASS = 'z-50';

export const customerMenuItemDetailShellClass = [
  'fixed inset-y-0 left-1/2 flex w-full -translate-x-1/2 flex-col',
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_ITEM_DETAIL_Z_CLASS,
  'bg-brand-bg transition-transform duration-300 ease-out',
].join(' ');

export const customerMenuItemDetailShellEnteredClass = 'translate-y-0';
export const customerMenuItemDetailShellExitedClass = 'translate-y-full';

/** Hero image plane — dominant first viewport of the detail. */
export const CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS =
  'relative h-[min(52vh,24rem)] w-full shrink-0 overflow-hidden bg-brand-border';

export const customerMenuItemDetailBackButtonClass =
  'absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-brand-card/90 text-brand-text shadow-sm backdrop-blur-sm border border-brand-border';

export const customerMenuItemDetailBodyClass =
  'modal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5';

export const customerMenuItemDetailFooterClass =
  'shrink-0 border-t border-brand-border bg-brand-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3';

export const customerMenuItemDetailFooterRowClass =
  'flex items-center gap-3';
