/** Soft keyboard open when the visual viewport is clearly shorter than the layout viewport. */
export function softKeyboardOpen(
  innerHeight: number,
  visualViewportHeight: number,
  thresholdPx = 120,
): boolean {
  return innerHeight - visualViewportHeight > thresholdPx;
}

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

/** Ignore open→closed jitter while the keyboard is still rising after focus. */
export const SOFT_KEYBOARD_DISMISS_ARM_MS = 400;

/**
 * iOS collapse-keyboard often skips input blur; commit when open → closed
 * after the post-focus arm window (so open-animation flicker does not exit edit).
 */
export function shouldCommitOnSoftKeyboardDismiss(
  wasOpen: boolean,
  nowOpen: boolean,
  options?: { armedAtMs: number; nowMs: number; armMs?: number },
): boolean {
  if (!(wasOpen && !nowOpen)) return false;
  if (options) {
    const armMs = options.armMs ?? SOFT_KEYBOARD_DISMISS_ARM_MS;
    if (options.nowMs - options.armedAtMs < armMs) return false;
  }
  return true;
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
