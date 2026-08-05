/**
 * Staff sticky top-bar chrome — one height + safe-area contract for
 * DashboardTopBar, StaffPersonalTopBar, board/detail sticky offsets, and
 * mobile dropdown positioning.
 *
 * Content row stays h-14 (3.5rem). Total sticky height adds safe-area-inset-top.
 * Horizontal inset uses safe-area with a tighter floor than legacy px-3 so brand
 * sits slightly left and trailing (role) sits slightly right.
 *
 * Layout end-state (no overflow-clip safety net):
 * - brand slot is the sole flex-1 min-w-0 grower (name truncates)
 * - hamburger + trailing are shrink-0
 * - intentional horizontal scroll only via `.mesa-chip-scroll`
 *
 * Tailwind class strings must be full literals (no ${} inside class names) so JIT
 * can emit utilities from this file.
 */

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
   */
  rowClassName:
    'flex h-14 min-w-0 items-center gap-1.5 sm:gap-2 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] sm:pl-[max(0.75rem,env(safe-area-inset-left,0px))] sm:pr-[max(0.75rem,env(safe-area-inset-right,0px))]',
  /** Logo + restaurant name — sole flex grow slot; truncates instead of overflowing. */
  brandClassName: 'flex min-w-0 flex-1 items-center',
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
