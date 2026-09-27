/** Soft keyboard open when the visual viewport is clearly shorter than the layout viewport. */
export function softKeyboardOpen(
  innerHeight: number,
  visualViewportHeight: number,
  thresholdPx = 120,
): boolean {
  return innerHeight - visualViewportHeight > thresholdPx;
}

/** iOS collapse-keyboard often skips input blur; commit when open → closed. */
export function shouldCommitOnSoftKeyboardDismiss(
  wasOpen: boolean,
  nowOpen: boolean,
): boolean {
  return wasOpen && !nowOpen;
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

/** Sole scroll path: keep a focused field inside the visual viewport. */
export function scrollElementIntoVisualViewport(
  el: HTMLElement,
  options?: { behavior?: ScrollBehavior },
): void {
  const behavior = options?.behavior ?? 'smooth';
  const vv = window.visualViewport;
  if (!vv) {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior });
    return;
  }
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
