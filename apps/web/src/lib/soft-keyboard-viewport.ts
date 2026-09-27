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
