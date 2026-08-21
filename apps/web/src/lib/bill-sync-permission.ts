import type { Capabilities } from '@/lib/permissions/can';
import { can } from '@/lib/permissions/can';

/**
 * Checkout detail「同步账单」button + POST/GET bill-syncs.
 * Single policy: capability only (feature flag is a separate product switch).
 */
export function maySyncBillToFiscal(capabilities: Capabilities): boolean {
  return can(capabilities, 'checkout.sync_bill');
}
