import type { Capabilities } from '@/lib/permissions/can';
import { can } from '@/lib/permissions/can';

/**
 * Sole UI/API gate for fiscal bill queue (print invoice via bill_sync_jobs).
 * Feature flag `bill_sync_to_fiscal` is a separate product switch.
 */
export function mayFiscalBillQueue(capabilities: Capabilities): boolean {
  return can(capabilities, 'checkout.sync_bill') && can(capabilities, 'tables.checkout_close');
}
