import type { DashboardAccessMode } from '@/lib/dashboard-access';
import type { FloorBoardRole } from '@/lib/floor-board-capabilities';
import type { CloseTableSessionClosedReason } from '@/lib/table-session/load-close-table-actor';

/**
 * Operational force-close (manual / unpaid reason) — not settled 关台结账.
 * Single policy for UI and server guards on POST /api/dashboard/close-table-session.
 */
export function mayForceCloseTableFromFloorRole(role: FloorBoardRole): boolean {
  return role === 'frontdesk';
}

export function mayForceCloseTableFromDashboardMode(mode: DashboardAccessMode): boolean {
  return mode === 'owner' || mode === 'frontdesk';
}

/** Actor reason on manual force-close only (settled checkout-close may still use cashier_closed). */
export function mayForceCloseTableAsManualActor(
  closedReason: CloseTableSessionClosedReason,
): boolean {
  return closedReason !== 'cashier_closed';
}
