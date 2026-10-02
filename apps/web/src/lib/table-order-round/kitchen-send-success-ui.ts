import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';

/**
 * Sole client rule: kitchen-send success UI exit when round status enters `cooldown`
 * from a different known status (not mount/bootstrap).
 *
 * - `finalize_failed` → `cooldown` counts (retry succeeded).
 * - Mount already on `cooldown` does not (prev null / first sample).
 * - Staying on `cooldown` does not (refresh replay).
 */
export function isKitchenSendSuccessStatusTransition(
  prev: TableOrderRoundStatus | null | undefined,
  next: TableOrderRoundStatus | null | undefined,
): boolean {
  if (next !== 'cooldown') return false;
  if (prev == null) return false;
  if (prev === 'cooldown') return false;
  return true;
}

/** Sole dedupe key for one success toast / dismiss per round. */
export function kitchenSendSuccessDedupeKey(roundId: string | null | undefined): string | null {
  const id = typeof roundId === 'string' ? roundId.trim() : '';
  return id.length > 0 ? id : null;
}
