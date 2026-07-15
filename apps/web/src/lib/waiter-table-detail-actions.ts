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
  hasOpenSession: boolean;
  hasActiveBuffets: boolean;
}): WaiterTableDetailActionFlags {
  const { embeddedInDashboard, isDemo, isCheckoutPending, hasOpenSession, hasActiveBuffets } = input;

  return {
    showBuffetPanel: hasActiveBuffets && !isDemo && !isCheckoutPending,
    showOccupiedToolbar: hasOpenSession,
    showCheckoutClose: embeddedInDashboard && hasOpenSession && !isCheckoutPending,
    showCloseTable: embeddedInDashboard && hasOpenSession,
  };
}
