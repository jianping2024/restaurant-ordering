let lockCount = 0;
let savedOverflow = '';

/** Sole body scroll lock — refcounted; do not set document.body.style.overflow elsewhere. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  lockCount += 1;
  if (lockCount === 1) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  return unlockBodyScroll;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedOverflow;
    savedOverflow = '';
  }
}

/** Route / bfcache / iOS preview recovery — clears stale locks and inline overflow. */
export function resetBodyScrollLock(): void {
  if (typeof document === 'undefined') return;
  lockCount = 0;
  savedOverflow = '';
  document.body.style.overflow = '';
}

export function bodyScrollLockCountForTest(): number {
  return lockCount;
}
