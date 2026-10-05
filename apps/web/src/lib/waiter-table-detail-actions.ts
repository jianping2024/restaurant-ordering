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
  /** Desk roles (tables.checkout_close) may 呼叫结账 → dashboard checkout. */
  showCallCheckout: boolean;
  /** Unpaid / force 关台 (tables.force_close); stays available during checkout lock. */
  showForceClose: boolean;
};

/** Session-context flags for table detail — all toolbar gates from floor caps here. */
export function resolveWaiterTableDetailActions(input: {
  caps: Pick<
    FloorBoardCapabilities,
    'canCallCheckout' | 'canTransfer' | 'canMerge' | 'canForceClose' | 'canOpenTableSession'
  >;
  isDemo: boolean;
  isCheckoutPending: boolean;
  hasOpenSession: boolean;
  hasActiveBuffets: boolean;
}): WaiterTableDetailActionFlags {
  const { caps, isDemo, isCheckoutPending, hasOpenSession, hasActiveBuffets } = input;
  const openAndEditable = hasOpenSession && !isCheckoutPending;

  return {
    showBuffetPanel:
      hasActiveBuffets && !isDemo && !isCheckoutPending && caps.canOpenTableSession,
    showOccupiedToolbar: hasOpenSession,
    showTransfer: caps.canTransfer && openAndEditable,
    showMerge: caps.canMerge && openAndEditable,
    showCallCheckout: caps.canCallCheckout && openAndEditable,
    showForceClose: caps.canForceClose && hasOpenSession,
  };
}
