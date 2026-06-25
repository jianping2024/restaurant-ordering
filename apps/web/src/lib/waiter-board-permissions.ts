import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

/** Waiter staff board: dining/idle tables open detail; checkout tables are view-only. Frontdesk: all clickable. */
export function isWaiterBoardTableCardClickable(
  embeddedInDashboard: boolean,
  boardState: WaiterTableBoardState,
): boolean {
  if (embeddedInDashboard) return true;
  return boardState !== 'checkout';
}

export function formatCheckoutPinnedSectionTitle(count: number, titleWithCount: string): string {
  return titleWithCount.replace('{n}', String(count));
}
