/**
 * CSS `bottom` for a `position:fixed` bar that sits on the visual-viewport
 * bottom edge (flush above the soft keyboard when one is open).
 */
export function fixedBarBottomAboveVisualViewport(
  innerHeight: number,
  visualViewportOffsetTop: number,
  visualViewportHeight: number,
): number {
  return Math.max(0, innerHeight - (visualViewportOffsetTop + visualViewportHeight));
}

/** Soft-keyboard settle delay (ms) after focus/blur before acting on edit state. */
export const SOFT_KEYBOARD_DISMISS_ARM_MS = 400;
