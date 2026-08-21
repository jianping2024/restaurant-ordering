import { billSyncContentFingerprint } from '@/lib/bill-sync-content-fingerprint';
import type { BillSyncPayload } from '@/lib/bill-sync-payload';

/**
 * Sole “content unchanged vs last succeeded sync” check (bill-sync-contract-v1.0).
 * True only when latest job is succeeded and live fingerprint matches that job payload.
 */
export function billSyncContentUnchanged(input: {
  jobStatus: string | null | undefined;
  jobPayload: BillSyncPayload | null | undefined;
  liveFingerprint: string | null;
}): boolean {
  if (input.jobStatus !== 'succeeded') return false;
  if (!input.liveFingerprint) return false;
  if (!input.jobPayload || typeof input.jobPayload !== 'object') return false;
  return billSyncContentFingerprint(input.jobPayload) === input.liveFingerprint;
}
