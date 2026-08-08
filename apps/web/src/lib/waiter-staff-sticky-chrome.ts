/**
 * Staff sticky top-bar chrome — one height + safe-area contract for
 * DashboardTopBar, StaffPersonalTopBar, board/detail sticky offsets, and
 * mobile dropdown positioning.
 *
 * Content row stays h-14 (3.5rem). Total sticky height adds safe-area-inset-top.
 * Horizontal inset lives solely on `STAFF_SHELL_CONTENT_CLASS` (same as main).
 *
 * Layout end-state (no header overflow-clip):
 * - brand grows (`flex-1`) with a logo floor (`min-w-[7rem]`) + `overflow-hidden`
 *   so the store name truncates and FARVOO never paints over nav
 * - right cluster is width-capped (`max-w-[calc(100%-7rem)]`, same 7rem floor) and
 *   may shrink; desktop nav scrolls inside via sole `.mesa-chip-scroll` + `max-w-full`
 * - hamburger + trailing stay shrink-0 inside the cluster
 * - row width uses sole `STAFF_SHELL_CONTENT_CLASS` (same column as DashboardShell)
 *
 * Tailwind class strings must be full literals (no ${} inside class names) so JIT
 * can emit utilities from this file. Content max-width is composed from the
 * imported sole token (complete utility names live in staff-shell-layout).
 */

import { STAFF_SHELL_CONTENT_CLASS } from '@/lib/staff-shell-layout';

/** Content row height only (Tailwind h-14). */
export const STAFF_TOP_BAR_CONTENT_HEIGHT = '3.5rem';

/** Sticky top bar total height including top safe area (inline styles / calc). */
export const STAFF_TOP_BAR_TOTAL_HEIGHT =
  'calc(3.5rem + env(safe-area-inset-top, 0px))';

/**
 * Sole narrow-viewport max-width for trailing text controls (license + role).
 * Desktop may widen via `sm:max-w-*` at the call site; do not invent a second mobile cap.
 */
export const STAFF_TOP_BAR_TRAILING_TEXT_MAX_CLASS = 'max-w-[5.5rem]';

/**
 * FARVOO wordmark floor (≥ measured sm logo ~103px) — keep the literal `7rem`
 * in sync with `rightClusterClassName` `max-w-[calc(100%-7rem)]` (one floor, two class strings).
 */
export const STAFF_TOP_BAR_BRAND_MIN_CLASS = 'min-w-[7rem]';

export const staffTopBarChrome = {
  headerClassName:
    'sticky top-0 z-30 min-w-0 shrink-0 border-b border-brand-border bg-brand-card pt-[env(safe-area-inset-top,0px)]',
  /**
   * Content row. Brand absorbs spare width; cluster is capped so the logo floor holds.
   * Width + X-pad = sole `STAFF_SHELL_CONTENT_CLASS` (no second pl/pr here).
   */
  rowClassName: [
    STAFF_SHELL_CONTENT_CLASS,
    'flex h-14 min-w-0 items-center gap-1.5 sm:gap-2',
  ].join(' '),
  /** Logo + restaurant name — grow slot with logo floor; overflow clips the name, not the wordmark. */
  brandClassName: [
    'flex flex-1 items-baseline overflow-hidden',
    STAFF_TOP_BAR_BRAND_MIN_CLASS,
  ].join(' '),
  /**
   * Store name beside FARVOO — mockup ink-soft + display face.
   * Sole staff-chrome restaurant label class (ProductTopBarBrand only).
   */
  restaurantNameClassName:
    'min-w-0 truncate font-heading text-sm text-brand-text-muted',
  /**
   * Nav + hamburger + trailing. Cap leaves the brand logo floor; desktop nav
   * scrolls inside (`.mesa-chip-scroll`), never competes past this width.
   */
  rightClusterClassName:
    'ml-auto flex min-w-0 max-w-[calc(100%-7rem)] shrink items-center self-stretch',
} as const;

/**
 * Offsets under the staff top bar. Board lane chrome and table-detail page
 * identity share `belowStaffTopBar`. Detail ordered-items sticks under page
 * identity (= top bar total + content-row h-14 heading).
 */
export const waiterStaffStickyChrome = {
  belowStaffTopBar: 'top-[calc(3.5rem+env(safe-area-inset-top,0px))]',
  belowPageHeading: 'top-[calc(3.5rem+3.5rem+env(safe-area-inset-top,0px))]',
} as const;
