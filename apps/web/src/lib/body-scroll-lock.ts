let lockCount = 0;
let savedBodyOverflow = '';
let savedHtmlOverflow = '';

/**
 * Guest menu vertical scrollports — storefront page scroll, else dual-pane catalog.
 * Sole selectors used by lockBodyScroll to freeze + restore position.
 */
export const MENU_SCROLLPORT_SELECTOR =
  '[data-mesa-storefront-menu-scroll], [data-mesa-menu-catalog-pane]';

/**
 * Sole skip rule: menu scrollports already inside an open modal dialog must keep
 * scrolling (staff continue-order {@link RightPushPanel}). Never freeze those.
 */
export const MENU_SCROLLPORT_LOCK_SKIP_CLOSEST = '[role="dialog"][aria-modal="true"]';

type SavedMenuScrollport = {
  el: HTMLElement;
  scrollTop: number;
  overflow: string;
};

let savedMenuScrollports: SavedMenuScrollport[] = [];

function shouldFreezeMenuScrollport(el: HTMLElement): boolean {
  return !el.closest(MENU_SCROLLPORT_LOCK_SKIP_CLOSEST);
}

function freezeMenuScrollports(): void {
  savedMenuScrollports = [];
  document.querySelectorAll<HTMLElement>(MENU_SCROLLPORT_SELECTOR).forEach((el) => {
    if (!shouldFreezeMenuScrollport(el)) return;
    const scrollTop = el.scrollTop;
    savedMenuScrollports.push({
      el,
      scrollTop,
      overflow: el.style.overflow,
    });
    el.style.overflow = 'hidden';
    // Some engines clear scrollTop when overflow flips — put it back while locked.
    el.scrollTop = scrollTop;
  });
}

function restoreMenuScrollports(): void {
  for (const saved of savedMenuScrollports) {
    if (!saved.el.isConnected) continue;
    saved.el.style.overflow = saved.overflow;
    saved.el.scrollTop = saved.scrollTop;
  }
  savedMenuScrollports = [];
}

/** Sole body scroll lock — refcounted; do not set overflow on body/html elsewhere. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  lockCount += 1;
  if (lockCount === 1) {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    freezeMenuScrollports();
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
    restoreMenuScrollports();
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
  restoreMenuScrollports();
}

export function bodyScrollLockCountForTest(): number {
  return lockCount;
}

/** Test-only: saved menu scrollport count while locked. */
export function savedMenuScrollportCountForTest(): number {
  return savedMenuScrollports.length;
}
