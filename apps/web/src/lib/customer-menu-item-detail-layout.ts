/**
 * Sole layout tokens for customer menu item detail (`CustomerMenuItemDetailSheet`).
 * Phone: fullscreen slide-up within the shell. lg+: centered dialog over dimmed backdrop.
 */

import { MENU_IMAGE_ASPECT_CLASS, MENU_IMAGE_WELL_BG_CLASS } from '@/lib/menu-image';

/** Above cart/round drawers (z-40) and footer dock (z-30). */
export const CUSTOMER_MENU_ITEM_DETAIL_Z_CLASS = 'z-50';

/** Full-viewport host: stretch on phone, centered dialog on lg+. */
export const customerMenuItemDetailHostClass = [
  'fixed inset-0 flex',
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
  'relative flex w-full flex-col overflow-hidden bg-brand-bg',
  'max-lg:h-full max-lg:max-w-mobile',
  'lg:max-h-[min(90vh,40rem)] lg:w-full lg:max-w-lg lg:rounded-2xl lg:border lg:border-brand-border lg:shadow-2xl',
  'transition duration-300 ease-out',
].join(' ');

export const customerMenuItemDetailPanelEnteredClass =
  'max-lg:translate-y-0 lg:translate-y-0 lg:scale-100 lg:opacity-100';

export const customerMenuItemDetailPanelExitedClass =
  'max-lg:translate-y-full lg:scale-95 lg:opacity-0';

/**
 * Hero — dominant top plane. Fixed 4:3 frame (matches upload
 * `MENU_IMAGE_ASPECT_RATIO`); image fit uses sole {@link MENU_IMAGE_OBJECT_FIT_CLASS}.
 */
export const CUSTOMER_MENU_ITEM_DETAIL_HERO_CLASS =
  `relative ${MENU_IMAGE_ASPECT_CLASS} w-full shrink-0 overflow-hidden ${MENU_IMAGE_WELL_BG_CLASS} max-lg:max-h-[min(52vh,24rem)]`;

export const customerMenuItemDetailCloseButtonClass =
  'absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-10 flex h-10 w-10 items-center justify-center rounded-full border border-brand-border bg-brand-card/90 text-brand-text shadow-sm backdrop-blur-sm';

export const customerMenuItemDetailBodyClass =
  'modal-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5';

export const customerMenuItemDetailFooterClass =
  'shrink-0 border-t border-brand-border bg-brand-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3';

export const customerMenuItemDetailFooterRowClass = 'flex items-center gap-3';
