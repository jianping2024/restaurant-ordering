/**
 * Customer menu shell — shared width budget and fixed overlay coordinates.
 * Bottom bar tokens live in customer-menu-bottom-bar-layout.ts; this module
 * covers header trailing slots and edge affordances (guest notice tab).
 *
 * Sole width: phone `max-w-mobile`, `lg+` ~1088px — page root, footer dock,
 * notice tab, and cart/ordered sheets all import this class (no parallel max-w-*).
 */

export const CUSTOMER_MENU_SHELL_WIDTH_CLASS =
  'w-full max-w-mobile lg:max-w-[68rem]';

/** Centered mobile shell used by menu page root and fixed overlays. */
export const customerMenuShellRootClass = `${CUSTOMER_MENU_SHELL_WIDTH_CLASS} mx-auto`;

/**
 * Fixed layer anchored to the centered shell (same X transform as the bottom bar).
 * Pair with CUSTOMER_MENU_SHELL_WIDTH_CLASS on the same element.
 */
export const customerMenuFixedShellDockClass =
  'fixed left-1/2 z-20 -translate-x-1/2';

/** Header trailing controls (theme, language, badges) — bounded, never steal title space. */
export const customerMenuHeaderTrailingSlotClass = 'shrink-0';

/**
 * Sole left category rail width (guest + staff-assisted + sushi).
 * Peer-float dodge padding must use the same token — never a parallel rem.
 */
export const CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS = 'w-[4.75rem]';
export const CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS = 'pl-[4.75rem]';

/**
 * Page-mode sticky left rail: under safe area, viewport-tall scroll pane.
 * Embedded mode uses overflow on the flex child instead (no sticky).
 */
export const customerMenuCategoryRailStickyClass =
  'sticky top-[env(safe-area-inset-top,0px)] z-20 max-h-[calc(100dvh-env(safe-area-inset-top,0px))] self-start';

/**
 * Sole subcategory chip strip sticky chrome (right column only).
 * Same top as the left rail (safe-area); opaque so list does not show through.
 * `-mx-3 px-3` cancels catalog host pad so the sticky fill spans the column.
 */
export const CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS =
  'mesa-chip-scroll sticky z-10 -mx-3 mb-3 flex gap-2 bg-brand-bg/95 px-3 py-2 backdrop-blur-sm';

/** Page scroll: stick under safe-area (aligned with left rail). */
export const CUSTOMER_MENU_SUBCATEGORY_STICKY_TOP_PAGE_CLASS =
  'top-[env(safe-area-inset-top,0px)]';

/** Embedded catalog pane: stick to that pane’s top. */
export const CUSTOMER_MENU_SUBCATEGORY_STICKY_TOP_EMBEDDED_CLASS = 'top-0';

/**
 * Guest notice tab vertical offset — below identity header + safe area.
 * Left category rail is beside the catalog (not a sticky top strip); calibrate to
 * compact identity row only. Static string for Tailwind JIT.
 */
export const CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS =
  'top-[calc(env(safe-area-inset-top,0px)+3.75rem)]';

/** Full-width shell track for the notice tab; children use pointer-events-auto. */
export const customerMenuNoticeTabShellClass = [
  customerMenuFixedShellDockClass,
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_NOTICE_TAB_TOP_CLASS,
  'pointer-events-none',
].join(' ');
