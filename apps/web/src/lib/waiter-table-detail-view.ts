import type { Buffet } from '@/types';

export function defaultActiveBuffet(buffets: Buffet[]): Buffet | null {
  return buffets.find((b) => b.is_active) ?? null;
}

export { normalizeWaiterTablePageModel, detailFromPageModel } from '@/lib/waiter-table-detail-normalize';
