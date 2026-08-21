import { createHash } from 'crypto';
import { splitPersonKey } from '@/lib/split-person-identity';

/**
 * Fixed namespace for bill-sync by_item person scope_id (UUID v5).
 * Sole mint for fiscal split scope_id from Farvoo bill_split + person identity.
 */
const BILL_SYNC_BY_ITEM_SCOPE_NS = Buffer.from('b1a5c7e04f2d5a6b8c9d0e1f2a3b4c5d', 'hex');

function uuidV5FromName(name: string): string {
  const hash = createHash('sha1').update(BILL_SYNC_BY_ITEM_SCOPE_NS).update(name, 'utf8').digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Stable UUID for one by_item person on a bill_split (FT idempotency scope_id).
 * Not person_index. Same bill + same person key → same id across re-sync.
 */
export function billSyncByItemScopeId(billSplitId: string, personName: string): string {
  const sale = billSplitId.trim().toLowerCase();
  const person = splitPersonKey(personName);
  return uuidV5FromName(`${sale}\0${person}`);
}
