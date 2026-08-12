import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';

/** Statuses that occupy the partial-unique active round slot per session. */
export const ACTIVE_ROUND_STATUSES: readonly TableOrderRoundStatus[] = [
  'collecting',
  'pending_confirm',
  'cooldown',
  'finalize_failed',
] as const;

export function isActiveRoundStatus(status: string): status is TableOrderRoundStatus {
  return (ACTIVE_ROUND_STATUSES as readonly string[]).includes(status);
}

export function isRoundBasketLocked(status: TableOrderRoundStatus): boolean {
  return status === 'pending_confirm';
}

export function canMutateRoundLines(status: TableOrderRoundStatus): boolean {
  return status === 'collecting';
}

export function isCooldownActive(status: TableOrderRoundStatus, cooldownUntil: string | null, nowMs = Date.now()): boolean {
  if (status !== 'cooldown') return false;
  if (!cooldownUntil) return false;
  const until = Date.parse(cooldownUntil);
  if (!Number.isFinite(until)) return false;
  return nowMs < until;
}

export function isCooldownExpired(status: TableOrderRoundStatus, cooldownUntil: string | null, nowMs = Date.now()): boolean {
  if (status !== 'cooldown') return false;
  if (!cooldownUntil) return true;
  const until = Date.parse(cooldownUntil);
  if (!Number.isFinite(until)) return true;
  return nowMs >= until;
}

export function isDeferCooldownActive(deferCooldownUntil: string | null, nowMs = Date.now()): boolean {
  if (!deferCooldownUntil) return false;
  const until = Date.parse(deferCooldownUntil);
  if (!Number.isFinite(until)) return false;
  return nowMs < until;
}

export function isSubmitDeadlinePassed(submitDeadlineAt: string | null, nowMs = Date.now()): boolean {
  if (!submitDeadlineAt) return false;
  const at = Date.parse(submitDeadlineAt);
  if (!Number.isFinite(at)) return false;
  return nowMs >= at;
}

export function roundCapTotal(perPersonCap: number, guestCount: number): number {
  if (perPersonCap < 1 || guestCount < 1) return 0;
  return perPersonCap * guestCount;
}
