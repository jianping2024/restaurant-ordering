import type { TableOrderRoundStatus } from '@/lib/table-order-round/types';
import { effectiveKitchenCooldownUntil } from '@/lib/table-order-round/status';

/**
 * Sole sushi「送厨」guidance state (footer guidance strip + round-review notice).
 * Table-level round only — the guest's local cart is a separate axis and never
 * moves this state (an unsent table round keeps warning while the cart fills).
 */
export type SushiSendGuidance =
  | { kind: 'unsent'; qty: number; full: boolean; cap: number }
  | { kind: 'countdown'; seconds: number }
  | { kind: 'failed' }
  | {
      kind: 'sent';
      seconds: number;
      /** Unsent free dishes already in the next basket during cooldown. */
      qty: number;
      full: boolean;
      cap: number;
    };

export function resolveSushiSendGuidance(input: {
  status: TableOrderRoundStatus | null | undefined;
  /** Authoritative session kitchen-send cooldown. */
  sessionCooldownUntil?: string | null | undefined;
  /** Legacy round.cooldown_until while status === cooldown. */
  cooldownUntil: string | null | undefined;
  submitDeadlineAt: string | null | undefined;
  /** Unsent table round qty (`useTableOrderRound().tableReviewQty`). */
  tableReviewQty: number;
  roundCapTotal: number;
  nowMs?: number;
}): SushiSendGuidance | null {
  const nowMs = input.nowMs ?? Date.now();

  if (input.status === 'pending_confirm') {
    return { kind: 'countdown', seconds: secondsUntil(input.submitDeadlineAt, nowMs) };
  }
  if (input.status === 'finalize_failed') return { kind: 'failed' };

  const coolingUntil = effectiveKitchenCooldownUntil({
    sessionCooldownUntil: input.sessionCooldownUntil,
    status: input.status,
    roundCooldownUntil: input.cooldownUntil,
    nowMs,
  });
  if (coolingUntil) {
    const qty = Math.max(0, Math.floor(input.tableReviewQty));
    const cap = Math.max(0, Math.floor(input.roundCapTotal));
    return {
      kind: 'sent',
      seconds: secondsUntil(coolingUntil, nowMs),
      qty,
      full: cap > 0 && qty >= cap,
      cap,
    };
  }

  const qty = Math.max(0, Math.floor(input.tableReviewQty));
  if (qty < 1) return null;
  const cap = Math.max(0, Math.floor(input.roundCapTotal));
  return { kind: 'unsent', qty, full: cap > 0 && qty >= cap, cap };
}

/** Live seconds left for guidance kinds that count down; others need no tick. */
export function sushiSendGuidanceTicks(guidance: SushiSendGuidance | null): boolean {
  return guidance?.kind === 'countdown' || guidance?.kind === 'sent';
}

function secondsUntil(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  const until = Date.parse(iso);
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, Math.ceil((until - nowMs) / 1000));
}
