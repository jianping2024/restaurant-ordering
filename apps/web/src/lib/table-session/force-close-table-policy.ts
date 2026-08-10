import type { Capabilities } from '@/lib/permissions/can';
import { mayForceCloseFromCaps } from '@/lib/permissions/resolve';

/**
 * Operational force-close (manual / unpaid reason).
 * Single policy for UI and POST /api/dashboard/close-table-session — capability only.
 * Actor identity / closed_reason is audit labeling, not a second gate.
 */
export function mayForceCloseTable(capabilities: Capabilities): boolean {
  return mayForceCloseFromCaps(capabilities);
}
