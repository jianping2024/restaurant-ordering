export type PairingRowLike = {
  expires_at: string;
  consumed_at: string | null;
  revoked_at?: string | null;
};

/** Unused, unexpired, not voided — list “pending” and claimable. */
export function isPendingPairing(row: PairingRowLike, nowMs = Date.now()): boolean {
  if (row.revoked_at) {
    return false;
  }
  if (row.consumed_at) {
    return false;
  }
  return new Date(row.expires_at).getTime() > nowMs;
}
