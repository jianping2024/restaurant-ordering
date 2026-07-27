import type { DashboardAccessMode } from '@/lib/dashboard-access';
import type { CloseTableSessionClosedReason } from '@/lib/table-session/load-close-table-actor';

/**
 * Operational force-close (manual / unpaid reason).
 * Single policy for UI and POST /api/dashboard/close-table-session.
 */
export function mayForceCloseTable(principal: DashboardAccessMode): boolean {
  return principal === 'owner' || principal === 'frontdesk';
}

export function forceClosePrincipalFromManualActorReason(
  closedReason: CloseTableSessionClosedReason,
): DashboardAccessMode {
  if (closedReason === 'owner_closed') return 'owner';
  if (closedReason === 'frontdesk_closed') return 'frontdesk';
  return 'cashier';
}
