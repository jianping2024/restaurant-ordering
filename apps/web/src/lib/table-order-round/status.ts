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

/** Countdown pending_confirm stays open for adds; only failed finalize locks the basket. */
export function isRoundBasketLocked(status: TableOrderRoundStatus): boolean {
  return status === 'finalize_failed';
}

/** Collecting + countdown: guests may still add/change free round lines. */
export function canMutateRoundLines(status: TableOrderRoundStatus): boolean {
  return status === 'collecting' || status === 'pending_confirm';
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

export function isSubmitDeadlinePassed(submitDeadlineAt: string | null, nowMs = Date.now()): boolean {
  if (!submitDeadlineAt) return false;
  const at = Date.parse(submitDeadlineAt);
  if (!Number.isFinite(at)) return false;
  return nowMs >= at;
}

/**
 * Sole cap on distinct guest phones per session for round writes. Free quota is per headcount
 * (not per phone), so the slack only absorbs re-scans / browser switches (new localStorage id).
 * 0 = no cap (headcount unknown).
 */
export function guestClientSeatLimit(guestCount: number): number {
  const n = Math.floor(guestCount);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.max(n + 2, n * 2);
}

export function roundCapTotal(perPersonCap: number, guestCount: number): number {
  if (perPersonCap < 1 || guestCount < 1) return 0;
  return perPersonCap * guestCount;
}
