import type { FloorBoardCapabilities } from '@/lib/floor-board-capabilities';

/** Which table-detail controls are available for the current session context. */
export type WaiterTableDetailActionFlags = {
  /** Buffet open / guest-count panel (production only, not during checkout). */
  showBuffetPanel: boolean;
  /**
   * Takeaway desk / takeaway session: show headcount UI but steppers frozen;
   * open uses open-takeaway; no buffet autosave.
   */
  buffetHeadcountLocked: boolean;
  /** Occupied-table toolbar: continue ordering, transfer, merge, etc. */
  showOccupiedToolbar: boolean;
  /** Capability-gated transfer button. */
  showTransfer: boolean;
  /** Capability-gated merge button. */
  showMerge: boolean;
  /**
   * Desk roles (tables.checkout_close) may 呼叫结账 → dashboard checkout.
   * Hidden when quick_table_close is on (then showCheckoutClose instead).
   */
  showCallCheckout: boolean;
  /**
   * Desk roles (tables.checkout_close) may 关台结账 (settled close).
   * Only when feature quick_table_close is on.
   */
  showCheckoutClose: boolean;
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
  /** Feature quick_table_close — mutual with call-checkout button. */
  quickTableClose?: boolean;
  /**
   * True when this desk opens as takeaway (group + flag) or the live session
   * is already stamped takeaway — sole UI lock for buffet headcount.
   */
  takeawayHeadcountLock?: boolean;
}): WaiterTableDetailActionFlags {
  const {
    caps,
    isDemo,
    isCheckoutPending,
    hasOpenSession,
    hasActiveBuffets,
    quickTableClose = false,
    takeawayHeadcountLock = false,
  } = input;
  const openAndEditable = hasOpenSession && !isCheckoutPending;
  const mayDeskCheckout = caps.canCallCheckout && openAndEditable;
  const showBuffetPanel =
    hasActiveBuffets && !isDemo && !isCheckoutPending && caps.canOpenTableSession;

  return {
    showBuffetPanel,
    buffetHeadcountLocked: showBuffetPanel && takeawayHeadcountLock,
    showOccupiedToolbar: hasOpenSession,
    showTransfer: caps.canTransfer && openAndEditable,
    showMerge: caps.canMerge && openAndEditable,
    showCallCheckout: mayDeskCheckout && !quickTableClose,
    showCheckoutClose: mayDeskCheckout && quickTableClose,
    showForceClose: caps.canForceClose && hasOpenSession,
  };
}
