let lockCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';

/** Sole body scroll lock — refcounted; do not set overflow on body/html elsewhere. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  lockCount += 1;
  if (lockCount === 1) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }
  return unlockBodyScroll;
}

export function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (lockCount <= 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
    savedBodyOverflow = '';
    savedHtmlOverflow = '';
  }
}

/** Route / bfcache / iOS preview recovery — clears stale locks and inline overflow. */
export function resetBodyScrollLock(): void {
  if (typeof document === 'undefined') return;
  lockCount = 0;
  savedBodyOverflow = '';
  savedHtmlOverflow = '';
  document.body.style.overflow = '';
  document.documentElement.style.overflow = '';
}

export function bodyScrollLockCountForTest(): number {
  return lockCount;
}
