import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';

/** Which table-detail controls are available for the current session context. */
export type WaiterTableDetailActionFlags = {
  /** Buffet open / guest-count panel (production only, not during checkout). */
  showBuffetPanel: boolean;
  /** Occupied-table toolbar: continue ordering, transfer, merge, etc. */
  showOccupiedToolbar: boolean;
  /** Capability-gated transfer button. */
  showTransfer: boolean;
  /** Capability-gated merge button. */
  showMerge: boolean;
  /** Desk roles may run 关台结账 (frontdesk prints; cashier skips print). */
  showCheckoutClose: boolean;
};

/** Session-context flags for table detail. Force-close policy is applied in layout, not here. */
export function resolveWaiterTableDetailActions(input: {
  caps: Pick<FloorBoardCapabilities, 'canCheckoutClose' | 'canTransfer' | 'canMerge'>;
  isDemo: boolean;
  isCheckoutPending: boolean;
  hasOpenSession: boolean;
  hasActiveBuffets: boolean;
}): WaiterTableDetailActionFlags {
  const { caps, isDemo, isCheckoutPending, hasOpenSession, hasActiveBuffets } = input;
  const openAndEditable = hasOpenSession && !isCheckoutPending;

  return {
    showBuffetPanel: hasActiveBuffets && !isDemo && !isCheckoutPending,
    showOccupiedToolbar: hasOpenSession,
    showTransfer: caps.canTransfer && openAndEditable,
    showMerge: caps.canMerge && openAndEditable,
    showCheckoutClose: caps.canCheckoutClose && openAndEditable,
  };
}
