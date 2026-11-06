import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';
import { isSessionKitchenCooldownActive } from '@/lib/table-order-round/status';

/**
 * Sole client rule: kitchen-send success UI exit after a successful finalize.
 *
 * New path: pending_confirm / finalize_failed → no active round (or fresh collecting)
 * while the session kitchen cooldown clock is live.
 * Legacy path: any known status → cooldown (settle still closes those rounds).
 *
 * Empty-basket reset (pending → collecting without a session clock) must not fire.
 */
export function isKitchenSendSuccessStatusTransition(input: {
  prev: TableOrderRoundStatus | null | undefined;
  next: TableOrderRoundStatus | null | undefined;
  sessionCooldownUntil?: string | null;
  nowMs?: number;
}): boolean {
  const { prev, next } = input;
  if (prev == null) return false;

  if (next === 'cooldown' && prev !== 'cooldown') return true;

  const fromSend =
    prev === 'pending_confirm' || prev === 'finalize_failed' || prev === 'collecting';
  if (!fromSend) return false;
  if (next !== null && next !== 'collecting') return false;
  return isSessionKitchenCooldownActive(input.sessionCooldownUntil, input.nowMs);
}

/** Sole dedupe key for one success toast / dismiss per send (session cooldown stamp). */
export function kitchenSendSuccessDedupeKey(
  sessionCooldownUntil: string | null | undefined,
): string | null {
  const until = typeof sessionCooldownUntil === 'string' ? sessionCooldownUntil.trim() : '';
  return until.length > 0 ? until : null;
}
