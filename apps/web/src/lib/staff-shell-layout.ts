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
export const STAFF_SHELL_MAIN_CLASS = 'min-h-0 min-w-0 flex-1 p-4 sm:p-6 lg:p-8';
