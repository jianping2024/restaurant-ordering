/**
 * Sole peer-float baseline rules (free round + paid):
 * - Per-source catchup seeds seen without emitting.
 * - After paid catchup, only lines with added_at strictly after baseline may float
 *   (merge-injected historical lines absorb into seen without float).
 */

/** Sole paid-line identity for peer-float seen set. */
export function peerFloatPaidItemKey(params: {
  orderId: string;
  batchId: string | null | undefined;
  lineId: string;
  addedAt: string | null | undefined;
}): string {
  return `${params.orderId}:${params.batchId || 'nobatch'}:${params.lineId}:${params.addedAt || ''}`;
}

/** Parse order-line added_at to ms; invalid/missing → null. */
export function parsePeerFloatAddedAtMs(addedAt: string | null | undefined): number | null {
  if (!addedAt) return null;
  const ms = Date.parse(addedAt);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Sole paid emit gate after catchup.
 * Missing/invalid added_at → do not float (absorb). Merge history has older timestamps.
 */
export function shouldEmitPaidPeerFloatAfterBaseline(
  addedAtMs: number | null,
  paidBaselineAtMs: number,
): boolean {
  if (addedAtMs == null) return false;
  return addedAtMs > paidBaselineAtMs;
}

/** Sole baseline stamp when paid catchup completes (client wall clock). */
export function mintPaidPeerFloatBaselineAtMs(nowMs: number = Date.now()): number {
  return nowMs;
}
