import type { Capabilities } from '@/lib/permissions/can';
import { mayForceCloseFromCaps } from '@/lib/permissions/resolve';
import type { SettledCloseActorReason } from '@/lib/table-session/operational-close-reasons';

/**
 * Operational force-close (manual / unpaid reason).
 * Single policy for UI and POST /api/dashboard/close-table-session — capability only.
 */
export function mayForceCloseTable(capabilities: Capabilities): boolean {
  return mayForceCloseFromCaps(capabilities);
}

/** Service guard: settled close reasons that imply force-close privilege. */
export function mayForceCloseTableForManualActor(
  closedReason: SettledCloseActorReason,
): boolean {
  // cashier_closed is checkout-close path, not force-close.
  return closedReason === 'owner_closed' || closedReason === 'frontdesk_closed';
}
