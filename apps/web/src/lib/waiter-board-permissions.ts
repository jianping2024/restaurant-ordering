import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

/** Waiter: dining/idle open detail; checkout tables view-only. Desk roles: all clickable. */
export function isWaiterBoardTableCardClickable(
  canOpenCheckoutPendingTables: boolean,
  boardState: WaiterTableBoardState,
): boolean {
  if (canOpenCheckoutPendingTables) return true;
  return boardState !== 'checkout';
}

export function formatCheckoutPinnedSectionTitle(count: number, titleWithCount: string): string {
  return titleWithCount.replace('{n}', String(count));
}
