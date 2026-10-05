/** Soft keyboard open when the visual viewport is clearly shorter than a layout baseline. */
export function softKeyboardOpen(
  layoutHeight: number,
  visualViewportHeight: number,
  thresholdPx = 120,
): boolean {
  return layoutHeight - visualViewportHeight > thresholdPx;
}

/**
 * Sole guest-bill rule: hide the fixed call-checkout CTA while the claim name
 * field is focused and the soft keyboard is (or is assumed) open. Keyboard
 * closed → show CTA even if iOS left the input focused.
 */
export function guestClaimNameHidesCallCheckout(
  nameFocused: boolean,
  softKeyboardIsOpen: boolean,
): boolean {
  return nameFocused && softKeyboardIsOpen;
}

/**
 * Layout height to compare against visualViewport on iOS: `innerHeight` often
 * shrinks with the keyboard, so prefer the taller of vv / inner / client.
 */
export function softKeyboardLayoutHeight(params: {
  visualViewportHeight: number;
  innerHeight: number;
  clientHeight: number;
}): number {
  return Math.max(
    params.visualViewportHeight,
    params.innerHeight,
    params.clientHeight,
  );
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
  options?: { behavior?: ScrollBehavior; layoutHeight?: number },
): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const layoutHeight =
    options?.layoutHeight ??
    softKeyboardLayoutHeight({
      visualViewportHeight: vv.height,
      innerHeight: window.innerHeight,
      clientHeight: document.documentElement.clientHeight,
    });
  if (!softKeyboardOpen(layoutHeight, vv.height)) return;

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
