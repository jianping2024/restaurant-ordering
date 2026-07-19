/**
 * Staff sticky top-bar chrome — one height + safe-area contract for
 * DashboardTopBar, StaffPersonalTopBar, board/detail sticky offsets, and
 * mobile dropdown positioning.
 *
 * Content row stays h-14 (3.5rem). Total sticky height adds safe-area-inset-top.
 * Horizontal inset uses safe-area with a tighter floor than legacy px-3 so brand
 * sits slightly left and trailing (role) sits slightly right.
 *
 * Tailwind class strings must be full literals (no ${} inside class names) so JIT
 * can emit utilities from this file.
 */

/** Content row height only (Tailwind h-14). */
export const STAFF_TOP_BAR_CONTENT_HEIGHT = '3.5rem';

/** Sticky top bar total height including top safe area (inline styles / calc). */
export const STAFF_TOP_BAR_TOTAL_HEIGHT =
  'calc(3.5rem + env(safe-area-inset-top, 0px))';

export const staffTopBarChrome = {
  headerClassName:
    'sticky top-0 z-30 shrink-0 border-b border-brand-border bg-brand-card pt-[env(safe-area-inset-top,0px)]',
  /**
   * Content row. Gap tightened vs legacy gap-2/px-3 so brand and trailing
   * sit closer to the horizontal safe edges without overlapping nav.
   */
  rowClassName:
    'flex h-14 items-center gap-1.5 sm:gap-2 pl-[max(0.5rem,env(safe-area-inset-left,0px))] pr-[max(0.5rem,env(safe-area-inset-right,0px))] sm:pl-[max(0.75rem,env(safe-area-inset-left,0px))] sm:pr-[max(0.75rem,env(safe-area-inset-right,0px))]',
  /**
   * Horizontal scroll for compact nav. self-stretch + items-center keeps the
   * scrollport as tall as the row so emoji glyphs are not clipped vertically
   * (overflow-x creates a scrollport that would otherwise clip overflow-y).
   */
  navClassName:
    'flex min-w-0 flex-1 items-center self-stretch overflow-x-auto overscroll-x-contain [scrollbar-width:thin] sm:overflow-visible',
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
