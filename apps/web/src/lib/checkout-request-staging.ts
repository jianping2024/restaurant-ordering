import type { BillSplit } from '@/types';

const STAGING_KEY = 'mesa:checkout-request-staging';

/** Stage a just-submitted row so dashboard checkout can show it before queue reload. */
export function stageCheckoutRequestForQueue(row: BillSplit): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STAGING_KEY, JSON.stringify(row));
  } catch {
    // ignore quota / private mode
  }
}

/** Read and clear one staged checkout row (dashboard provider mount). */
export function consumeStagedCheckoutRequest(): BillSplit | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STAGING_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STAGING_KEY);
    const parsed = JSON.parse(raw) as BillSplit;
    if (!parsed?.id || !parsed.table_id) return null;
    return parsed;
  } catch {
    return null;
  }
}
