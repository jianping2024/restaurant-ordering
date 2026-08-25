import type { Capabilities } from '@/lib/permissions/can';
import { can } from '@/lib/permissions/can';

/**
 * Sole UI gate for「同步关台」(sync + settled checkout close).
 * Feature flag `bill_sync_to_fiscal` is a separate product switch.
 */
export function maySyncAndCheckoutClose(capabilities: Capabilities): boolean {
  return can(capabilities, 'checkout.sync_bill') && can(capabilities, 'tables.checkout_close');
}
