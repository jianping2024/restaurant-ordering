/**
 * Sole font-size token for focusable form controls (input / select / textarea).
 * iOS Safari auto-zooms when focused controls render below 16px (`text-base`).
 */
export const FORM_CONTROL_TEXT_CLASS = 'text-base';

/**
 * Sole empty-field hint color for native input/textarea placeholders.
 * Token: `--color-brand-placeholder` (not full-strength `brand-text-muted`).
 * react-select and other non-Tailwind surfaces must use the same CSS variable.
 */
export const FORM_CONTROL_PLACEHOLDER_CLASS = 'placeholder:text-brand-placeholder';

/**
 * Sole compact `type="search"` chrome for dashboard list toolbars
 * (operation logs, dish history). Fixed width; no field label above.
 */
export const DASHBOARD_COMPACT_SEARCH_CLASS =
  `w-[11rem] rounded-md border border-brand-border bg-brand-bg px-2 py-1 text-base text-brand-text ${FORM_CONTROL_PLACEHOLDER_CLASS}`;
