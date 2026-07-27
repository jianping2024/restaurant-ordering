import type { DashboardAccessMode } from '@/lib/dashboard-access';
import type { SettledCloseActorReason } from '@/lib/table-session/operational-close-reasons';

/**
 * Operational force-close (manual / unpaid reason).
 * Single policy for UI and POST /api/dashboard/close-table-session.
 *
 * Floor-board checkout-close stays in `floorBoardCapabilities`; force-close is policy,
 * not a desk capability flag — see ToolbarCloseTableControl / CheckoutRequestDetailHost.
 */
export function mayForceCloseTable(principal: DashboardAccessMode): boolean {
  return principal === 'owner' || principal === 'frontdesk';
}

function manualActorReasonToPrincipal(
  closedReason: SettledCloseActorReason,
): Extract<DashboardAccessMode, 'owner' | 'frontdesk' | 'cashier'> {
  if (closedReason === 'owner_closed') return 'owner';
  if (closedReason === 'frontdesk_closed') return 'frontdesk';
  return 'cashier';
}

/** Service guard for manual force-close using dashboard actor reason from loadCloseTableSessionActor. */
export function mayForceCloseTableForManualActor(
  closedReason: SettledCloseActorReason,
): boolean {
  return mayForceCloseTable(manualActorReasonToPrincipal(closedReason));
}
