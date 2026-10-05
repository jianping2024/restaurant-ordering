/** Soft keyboard open when the visual viewport is clearly shorter than the layout viewport. */
export function softKeyboardOpen(
  innerHeight: number,
  visualViewportHeight: number,
  thresholdPx = 120,
): boolean {
  return innerHeight - visualViewportHeight > thresholdPx;
}

/**
 * Sole guest-bill rule: hide the fixed call-checkout CTA only while the claim
 * name field is focused AND the soft keyboard is open. Keyboard closed (even
 * if iOS left the input focused) → show the CTA again.
 */
export function guestClaimNameHidesCallCheckout(
  nameFocused: boolean,
  softKeyboardIsOpen: boolean,
): boolean {
  return nameFocused && softKeyboardIsOpen;
}

/**
 * Scroll delta so the focused control sits in the upper-middle of the visual
 * viewport (above the soft keyboard). Pure — callers apply via window.scrollBy.
 */
export function scrollDeltaIntoVisualViewport(params: {
  elementTop: number;
  elementHeight: number;
  viewportOffsetTop: number;
  viewportHeight: number;
  /** 0–1; default ~0.35 keeps the field above the keyboard midline. */
  targetRatio?: number;
}): number {
  const {
    elementTop,
    elementHeight,
    viewportOffsetTop,
    viewportHeight,
    targetRatio = 0.35,
  } = params;
  if (viewportHeight <= 0) return 0;
  const desiredTop =
    viewportOffsetTop + viewportHeight * targetRatio - elementHeight / 2;
  return elementTop - desiredTop;
}

/**
 * Sole scroll path: keep a focused field inside the visual viewport.
 * Only runs while the soft keyboard is open — scrolling during focus/open
 * animation dismisses the iOS keyboard.
 */
export function scrollElementIntoVisualViewport(
  el: HTMLElement,
  options?: { behavior?: ScrollBehavior },
): void {
  const vv = window.visualViewport;
  if (!vv) return;
  if (!softKeyboardOpen(window.innerHeight, vv.height)) return;

  const behavior = options?.behavior ?? 'instant';
  const rect = el.getBoundingClientRect();
  const padding = 12;
  const viewTop = vv.offsetTop + padding;
  const viewBottom = vv.offsetTop + vv.height - padding;
  if (rect.top >= viewTop && rect.bottom <= viewBottom) return;
  const delta = scrollDeltaIntoVisualViewport({
    elementTop: rect.top,
    elementHeight: rect.height,
    viewportOffsetTop: vv.offsetTop,
    viewportHeight: vv.height,
  });
  if (Math.abs(delta) < 1) return;
  window.scrollBy({ top: delta, left: 0, behavior });
}
