/** Which table-detail controls are available for the current session context. */
export type WaiterTableDetailActionFlags = {
  /** Buffet open / guest-count panel (production only, not during checkout). */
  showBuffetPanel: boolean;
  /** Occupied-table toolbar: continue ordering, transfer, merge, etc. */
  showOccupiedToolbar: boolean;
  /** Frontdesk may print session bill and close the table. */
  showCheckoutClose: boolean;
  /** Frontdesk may close the table session. */
  showCloseTable: boolean;
};

export function resolveWaiterTableDetailActions(input: {
  embeddedInDashboard: boolean;
  isDemo: boolean;
  isCheckoutPending: boolean;
  isOccupied: boolean;
  hasActiveBuffets: boolean;
}): WaiterTableDetailActionFlags {
  const { embeddedInDashboard, isDemo, isCheckoutPending, isOccupied, hasActiveBuffets } = input;

  return {
    showBuffetPanel: hasActiveBuffets && !isDemo && !isCheckoutPending,
    showOccupiedToolbar: isOccupied,
    showCheckoutClose: embeddedInDashboard && isOccupied && !isCheckoutPending,
    showCloseTable: embeddedInDashboard && isOccupied,
  };
}
