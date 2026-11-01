/**
 * Staff sticky top-bar chrome — one height + safe-area contract for
 * DashboardTopBar, StaffPersonalTopBar, board/detail sticky offsets, and
 * mobile dropdown positioning.
 *
 * Content row stays h-14 (3.5rem). Total sticky height adds safe-area-inset-top.
 * Horizontal inset lives solely on `STAFF_SHELL_CONTENT_CLASS` (same as main).
 *
 * Layout end-state (no header overflow-clip):
 * - brand is `min-w-0 flex-1`: FARVOO stays intrinsic; store name yields into the
 *   leftover slot via sole `fitStaffTopBarRestaurantName` (drop words from the
 *   right, then ellipsize the last word) — never CSS `truncate` as a second path
 * - right cluster: mobile `shrink-0` so ☰ + account stay clickable; `lg:flex-1
 *   lg:min-w-0` so desktop chip nav can scroll inside `.mesa-chip-scroll`
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

export const staffTopBarChrome = {
  headerClassName:
    'sticky top-0 z-30 min-w-0 shrink-0 border-b border-brand-border bg-brand-card pt-[env(safe-area-inset-top,0px)]',
  /**
   * Content row. Brand yields width; right cluster keeps actions (mobile) / chip scroll (lg+).
   * Width + X-pad = sole `STAFF_SHELL_CONTENT_CLASS` (no second pl/pr here).
   */
  rowClassName: [
    STAFF_SHELL_CONTENT_CLASS,
    'flex h-14 min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2',
  ].join(' '),
  /** Logo + fitted store name — takes leftover after the right cluster. */
  brandClassName: 'flex min-w-0 flex-1 items-center',
  /**
   * Fitted store name beside FARVOO — one line; text from
   * `fitStaffTopBarRestaurantName` only (ProductTopBarRestaurantName).
   * Full literal for Tailwind JIT (do not compose with ${}).
   */
  restaurantNameClassName:
    'block max-w-full min-w-0 overflow-hidden whitespace-nowrap font-heading text-base font-medium leading-none text-brand-text sm:text-lg',
  /**
   * Offscreen width probe — same type metrics as the visible name, no max-w clamp.
   * Sole companion to `restaurantNameClassName` for measure callbacks.
   */
  restaurantNameMeasureClassName:
    'whitespace-nowrap font-heading text-base font-medium leading-none text-brand-text sm:text-lg',
  /**
   * Nav + hamburger + trailing. Mobile: shrink-0 so actions stay clickable.
   * lg+: flex-1 min-w-0 so chip nav scrolls inside `.mesa-chip-scroll`.
   */
  rightClusterClassName:
    'ml-auto flex shrink-0 items-center justify-end self-stretch lg:min-w-0 lg:flex-1 lg:shrink',
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

/**
 * Shared SettlementBar sticky chrome (layout + sole paper fill).
 * One fill for both paths — brand-bg matches staff page / sheet paper so the rounded
 * gold inset never rings with lighter card white. Path shells differ only by sticky offset.
 */
const checkoutSettlementBarStickyChrome =
  'z-20 -mx-2 px-2 py-1 backdrop-blur-sm bg-brand-bg/95 supports-[backdrop-filter]:bg-brand-bg/90';

/**
 * Default sticky shell for checkout `SettlementBar` on `/dashboard/checkout`.
 * Sticks under the staff top bar — never bare `top-0` (staff bar is also `top-0` / z-30).
 */
export const checkoutSettlementBarStickyShellClass = [
  'sticky',
  waiterStaffStickyChrome.belowStaffTopBar,
  checkoutSettlementBarStickyChrome,
].join(' ');

/**
 * Sole sticky shell for dashboard primary action toolbars (e.g. menu 添加菜品 /
 * 添加分组, settings profile 保存设置) under the staff top bar. Opaque paper fill
 * so list rows never show through; never bare `top-0`. Call sites own outer
 * spacing (`mb-*` / `space-y-*`).
 */
export const dashboardStickyToolbarShellClass = [
  'sticky',
  waiterStaffStickyChrome.belowStaffTopBar,
  'z-20 -mx-2 px-2 py-2.5 bg-brand-bg border-b border-brand-border/40',
].join(' ');
