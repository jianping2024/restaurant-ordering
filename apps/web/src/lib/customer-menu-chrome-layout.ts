/**
 * Customer menu shell — shared width budget and fixed overlay coordinates.
 * Bottom bar tokens live in customer-menu-bottom-bar-layout.ts; this module
 * covers header trailing slots and edge affordances (guest notice tab).
 */

export const CUSTOMER_MENU_SHELL_WIDTH_CLASS = 'w-full max-w-mobile';

/** Centered mobile shell used by menu page root and fixed overlays. */
export const customerMenuShellRootClass = `${CUSTOMER_MENU_SHELL_WIDTH_CLASS} mx-auto`;

/**
 * Fixed layer anchored to the centered shell (same X transform as the bottom bar).
 * Pair with CUSTOMER_MENU_SHELL_WIDTH_CLASS on the same element.
 */
export const customerMenuFixedShellDockClass =
  'fixed left-1/2 z-20 -translate-x-1/2';

/** Header trailing controls (language, badges) — bounded, never steal title space. */
export const customerMenuHeaderTrailingSlotClass = 'shrink-0';

/**
 * Guest notice tab vertical offset — below sticky header + safe area.
 * Static string for Tailwind JIT.
 */
export const CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS =
  'top-[calc(env(safe-area-inset-top,0px)+7.5rem)]';

/** Full-width shell track for the notice tab; children use pointer-events-auto. */
export const customerMenuNoticeTabShellClass = [
  customerMenuFixedShellDockClass,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  'pointer-events-none',
].join(' ');
