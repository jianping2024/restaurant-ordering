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

/**
 * Sole left category rail width (guest + staff-assisted + sushi).
 * Peer-float dodge padding must use the same token — never a parallel rem.
 * Live width is CSS `--mesa-menu-category-rail-w` (76px → 112px when the dual-pane
 * root is ≥46rem, see globals.css); the root is the `mesa-menu-shell` container.
 */
export const CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS = 'w-[var(--mesa-menu-category-rail-w,4.75rem)]';
export const CUSTOMER_MENU_CATEGORY_RAIL_DODGE_PL_CLASS = 'pl-[var(--mesa-menu-category-rail-w,4.75rem)]';

/**
 * Sole guest/staff menu body root: flex column, no document scroll inside.
 * Guest page adds `h-dvh` + shell width; staff embedded adds `min-h-0 flex-1`.
 * Header / sushi bar / gate stay shrink-0 above; category nav fills the rest.
 */
export const customerMenuDualPaneRootClass =
  'mesa-menu-shell relative flex flex-col overflow-hidden bg-brand-bg';
/**
 * Sole category nav shell (guest page + staff embedded): fills remaining height;
 * left rail and right catalog each scroll independently (overscroll contained).
 * `min-w-0 w-full overflow-hidden` keeps the row inside the shell width so the
 * catalog host never measures past the viewport (false 2-col / clipped +).
 */
export const customerMenuCategoryNavShellClass =
  'flex min-h-0 min-w-0 w-full flex-1 overflow-hidden';

/** Sole left top-category rail scrollport. */
export const customerMenuCategoryRailClass = [
  CUSTOMER_MENU_CATEGORY_RAIL_WIDTH_CLASS,
  'z-20 flex shrink-0 flex-col overflow-y-auto overscroll-y-contain border-r border-brand-border bg-brand-card/40',
].join(' ');

/**
 * Sole right catalog scrollport (pair with `CUSTOMER_MENU_ITEM_LIST_HOST_CLASS`
 * on the same element for container-query columns).
 * Vertical scroll only — no horizontal bleed past the dual-pane shell.
 * No top padding on the scrollport: `sticky top-0` would stop at the padding edge
 * and leak content above the chips. Top air is a scrolling `before:` spacer instead.
 */
export const customerMenuCatalogPaneClass =
  "min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-4 before:block before:h-4 before:content-['']";

/**
 * Sole subcategory chip strip sticky chrome (right catalog pane only).
 * Flush to that pane’s top edge (`top-0`, pane has no pt); opaque so the list never shows through.
 * `-mx-3 px-3` cancels catalog host pad so the sticky fill spans the column.
 */
export const CUSTOMER_MENU_SUBCATEGORY_STICKY_SHELL_CLASS =
  'mesa-chip-scroll sticky top-0 z-10 -mx-3 mb-3 flex gap-2 bg-brand-bg px-3 py-2';

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
