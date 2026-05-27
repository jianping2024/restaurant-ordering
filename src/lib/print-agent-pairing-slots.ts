/** Max concurrent unused pairing codes per restaurant (see POST /api/print-agent/pairing). */
export const PRINT_AGENT_PAIRING_PENDING_SLOT_MAX = 3;

export type PairingRowLike = {
  expires_at: string;
  consumed_at: string | null;
  revoked_at?: string | null;
};

export function isPendingPairing(row: PairingRowLike, nowMs = Date.now()): boolean {
  if (row.revoked_at) {
    return false;
  }
  if (row.consumed_at) {
    return false;
  }
  return new Date(row.expires_at).getTime() > nowMs;
}
