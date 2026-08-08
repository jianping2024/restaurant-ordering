/**
 * Shared main region for dashboard and staff board shells.
 *
 * Do not put non-visible `overflow-x` on this node: browsers form a scrollport
 * (overflow-y becomes auto) and `position: sticky` under the staff top bar never
 * engages against the document — board lanes and table-detail chrome break.
 * Clip wide children at the feature that overflows (e.g. `mesa-chip-scroll`).
 *
 * `min-w-0` is the sole flex shrink contract so chip strips scroll inside
 * themselves instead of widening the document.
 */

/**
 * Sole staff content column (floor 6-col dense: `max-w-[120rem]` ≈ 1920).
 * Used by DashboardShell main inner + staff top-bar row — one left edge for
 * FARVOO / KPI / search. Do not redeclare max-w or a second X-pad on
 * dashboard feature pages or on the top-bar row.
 */
export const STAFF_SHELL_CONTENT_CLASS =
  'mx-auto w-full max-w-[120rem] pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:pl-[max(1.5rem,env(safe-area-inset-left,0px))] sm:pr-[max(1.5rem,env(safe-area-inset-right,0px))]';

/** Main: vertical pad only — horizontal inset lives solely on CONTENT_CLASS. */
export const STAFF_SHELL_MAIN_CLASS = 'min-h-0 min-w-0 flex-1 py-4 sm:py-6 lg:py-8';
