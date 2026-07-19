import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';

/** Which table-detail controls are available for the current session context. */
export type WaiterTableDetailActionFlags = {
  /** Buffet open / guest-count panel (production only, not during checkout). */
  showBuffetPanel: boolean;
  /** Occupied-table toolbar: continue ordering, transfer, merge, etc. */
  showOccupiedToolbar: boolean;
  /** Desk roles may run 关台结账 (frontdesk prints; cashier skips print). */
  showCheckoutClose: boolean;
  /** Desk roles may force-close the table session. */
  showCloseTable: boolean;
};

export function resolveWaiterTableDetailActions(input: {
  caps: Pick<FloorBoardCapabilities, 'canCheckoutClose' | 'canForceCloseTable'>;
  isDemo: boolean;
  isCheckoutPending: boolean;
  hasOpenSession: boolean;
  hasActiveBuffets: boolean;
}): WaiterTableDetailActionFlags {
  const { caps, isDemo, isCheckoutPending, hasOpenSession, hasActiveBuffets } = input;

  return {
    showBuffetPanel: hasActiveBuffets && !isDemo && !isCheckoutPending,
    showOccupiedToolbar: hasOpenSession,
    showCheckoutClose: caps.canCheckoutClose && hasOpenSession && !isCheckoutPending,
    showCloseTable: caps.canForceCloseTable && hasOpenSession,
  };
}
