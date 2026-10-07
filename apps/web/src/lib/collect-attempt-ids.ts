/**
 * Sole client-side id for one collect-payment attempt (`client_request_id` on confirm-payment).
 * A retry of the same attempt (timeout / dropped response) must reuse the id so the server
 * replays the stored payment; a new collect of the same ticket gets a fresh id after `settle`.
 * Mint is the sole `mintBrowserUuid`.
 */
import { mintBrowserUuid } from '@/lib/browser-uuid';
import type { BillSyncPaymentLine } from '@/lib/bill-sync-payload';

export function collectAttemptFingerprint(params: {
  billSplitId: string;
  personIndex: number;
  amount: number;
  paymentMethod: string;
  paymentLines?: BillSyncPaymentLine[] | null;
}): string {
  const { billSplitId, personIndex, amount, paymentMethod, paymentLines } = params;
  return JSON.stringify([billSplitId, personIndex, amount, paymentMethod, paymentLines ?? null]);
}

export function createCollectAttemptIds(mint: () => string = mintBrowserUuid) {
  const ids = new Map<string, string>();
  return {
    /** Same fingerprint → same id until `settle`. */
    idFor(fingerprint: string): string {
      let id = ids.get(fingerprint);
      if (!id) {
        id = mint();
        ids.set(fingerprint, id);
      }
      return id;
    },
    /** The attempt succeeded: the next collect with the same shape is a new payment. */
    settle(fingerprint: string): void {
      ids.delete(fingerprint);
    },
  };
}
