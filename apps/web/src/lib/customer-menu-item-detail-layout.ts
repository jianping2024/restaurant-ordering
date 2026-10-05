/**
 * Sole layout tokens for customer menu item detail (`CustomerMenuItemDetailSheet`).
 * Phone: fullscreen slide-up within the shell. lg+: centered dialog over dimmed backdrop.
 * Scroll: one column (hero + copy); footer CTA stays pinned; host/body lock keeps menu behind still.
 */

import { MENU_IMAGE_ASPECT_CLASS, MENU_IMAGE_WELL_BG_CLASS } from '@/lib/menu-image';

/** Above cart/round drawers (z-40) and footer dock (z-30). */
export const CUSTOMER_MENU_ITEM_DETAIL_Z_CLASS = 'z-50';

/**
 * Sole horizontal gutter for detail copy + footer (same 20px as CustomerMenuBottomSheet).
 * Close button end inset matches this gutter (`right-5`).
 */
export const CUSTOMER_MENU_ITEM_DETAIL_GUTTER_X_CLASS = 'px-5';

/** Full-viewport host: stretch on phone, centered dialog on lg+. */
export const customerMenuItemDetailHostClass = [
  'fixed inset-0 flex overflow-hidden overscroll-none',
  CUSTOMER_MENU_ITEM_DETAIL_Z_CLASS,
  'max-lg:items-stretch max-lg:justify-center',
  'lg:items-center lg:justify-center lg:p-4',
].join(' ');

export const customerMenuItemDetailBackdropClass =
  'absolute inset-0 bg-transparent max-lg:pointer-events-none lg:bg-black/60 lg:backdrop-blur-sm lg:pointer-events-auto';

/**
 * Detail panel — phone full-height shell width; lg+ modal card (not the wide menu shell).
 * Static Tailwind strings only (JIT).
 */
export const customerMenuItemDetailPanelClass = [
  'relative flex w-full flex-col overflow-hidden overscroll-none bg-brand-bg',
  'max-lg:h-full max-lg:max-w-mobile',
  'lg:max-h-[min(90vh,40rem)] lg:w-full lg:max-w-lg lg:rounded-2xl lg:border lg:border-brand-border lg:shadow-2xl',
  'transition duration-300 ease-out',
].join(' ');

export const customerMenuItemDetailPanelEnteredClass =
  'max-lg:translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100';

export const customerMenuItemDetailPanelExitedClass =
  'max-lg:translate-y-full lg:scale-95 lg:opacity-0';

/**
 * Hero — in the same scroll column as copy (not a pinned band).
 * Keep upload 4:3 aspect; display height capped ~⅓ viewport so name/price/allergens fit first paint.
 */
export const CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS =
  `relative w-full shrink-0 overflow-hidden ${MENU_IMAGE_ASPECT_CLASS} ${MENU_IMAGE_WELL_BG_CLASS} max-h-[min(33vh,14rem)]`;

export const customerMenuItemDetailCloseButtonClass =
  'absolute right-5 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-card/90 text-brand-text shadow-sm backdrop-blur-sm';

/** Sole vertical scroller for hero + copy. */
export const customerMenuItemDetailBodyClass =
  'modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain';

/** Padded copy below the full-bleed hero inside the scroller. */
export const customerMenuItemDetailContentClass =
  `${CUSTOMER_MENU_ITEM_DETAIL_GUTTER_X_CLASS} pb-4 pt-5`;

/**
 * Pinned CTA row — same gutter as copy; bottom = 1rem content pad + sole
 * `--mesa-customer-menu-bottom-safe` (cannot stack two Tailwind `pb-*` utilities).
 */
export const customerMenuItemDetailFooterClass =
  `shrink-0 border-t border-brand-border bg-brand-card ${CUSTOMER_MENU_ITEM_DETAIL_GUTTER_X_CLASS} pt-3 pb-[calc(1rem+var(--mesa-customer-menu-bottom-safe))]`;

export const customerMenuItemDetailFooterRowClass = 'flex items-center gap-3';
