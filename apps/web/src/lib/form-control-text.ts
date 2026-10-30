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
