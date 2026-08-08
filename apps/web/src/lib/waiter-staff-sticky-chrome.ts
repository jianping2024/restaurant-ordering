/**
 * Staff sticky top-bar chrome — one height + safe-area contract for
 * DashboardTopBar, StaffPersonalTopBar, board/detail sticky offsets, and
 * mobile dropdown positioning.
 *
 * Content row stays h-14 (3.5rem). Total sticky height adds safe-area-inset-top.
 * Horizontal inset lives solely on `STAFF_SHELL_CONTENT_CLASS` (same as main).
 *
 * Layout end-state (no overflow-clip safety net):
 * - brand slot is the sole flex-1 min-w-0 grower (name truncates)
 * - nav + trailing share one right cluster (`rightClusterClassName`, ml-auto)
 * - hamburger + trailing are shrink-0 inside the cluster
 * - intentional horizontal scroll only via `.mesa-chip-scroll` on desktop nav
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

export const staffTopBarChrome = {
  headerClassName:
    'sticky top-0 z-30 min-w-0 shrink-0 border-b border-brand-border bg-brand-card pt-[env(safe-area-inset-top,0px)]',
  /**
   * Content row. Brand is flex-1 + min-w-0 so long names absorb squeeze;
   * hamburger and trailing stay shrink-0 and never push the document wide.
   * Width + X-pad = sole `STAFF_SHELL_CONTENT_CLASS` (no second pl/pr here).
   */
  rowClassName: [
    STAFF_SHELL_CONTENT_CLASS,
    'flex h-14 min-w-0 items-center gap-1.5 sm:gap-2',
  ].join(' '),
  /** Logo + restaurant name — sole flex grow slot; truncates instead of overflowing. */
  brandClassName: 'flex min-w-0 flex-1 items-baseline',
  /**
   * Store name beside FARVOO — mockup ink-soft + display face.
   * Sole staff-chrome restaurant label class (ProductTopBarBrand only).
   */
  restaurantNameClassName:
    'min-w-0 truncate font-heading text-sm text-brand-text-muted',
  /** Desktop nav + hamburger + trailing — single right-aligned cluster; may shrink for chip scroll. */
  rightClusterClassName:
    'ml-auto flex min-w-0 shrink items-center self-stretch',
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
