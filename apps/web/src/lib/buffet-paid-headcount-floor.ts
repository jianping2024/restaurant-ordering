import {
  buildLockedPersonLineMins,
  isCheckoutSplitLocked,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { BuffetGuestCounts, BuffetGuestSnapshot } from '@/lib/buffet-order';
import type { BillSplit } from '@/types';

/** Billable line key for a buffet package (matches `buildBillableSessionItems`). */
export function buffetBillableLineKey(buffetId: string): string {
  return `buffet:${buffetId}`;
}

export function buffetIdFromBillableLineKey(lineKey: string): string | null {
  if (!lineKey.startsWith('buffet:')) return null;
  const id = lineKey.slice('buffet:'.length);
  return id || null;
}

/**
 * Minimum adult/child headcount per buffet_id that must remain after collection
 * starts — sum of locked by-item buffet shares for paid / ledger-locked guests.
 */
export function lockedBuffetHeadcountByBuffetId(
  split: BillSplit | null | undefined,
  hasCollectedLedger = false,
  collectedPayments: SessionCollectedPayment[] = [],
): Map<string, BuffetGuestCounts> {
  const byBuffet = new Map<string, BuffetGuestCounts>();
  if (!isCheckoutSplitLocked(split, hasCollectedLedger)) {
    return byBuffet;
  }

  const locks = buildLockedPersonLineMins(split, hasCollectedLedger, collectedPayments);
  for (const [mapKey, mins] of Array.from(locks.buffet.entries())) {
    const sep = mapKey.lastIndexOf('::');
    if (sep < 0) continue;
    const buffetId = buffetIdFromBillableLineKey(mapKey.slice(0, sep));
    if (!buffetId) continue;
    if (mins.adults <= 0 && mins.children <= 0) continue;
    const entry = byBuffet.get(buffetId) ?? { adults: 0, children: 0 };
    entry.adults += mins.adults;
    entry.children += mins.children;
    byBuffet.set(buffetId, entry);
  }
  return byBuffet;
}

export type BuffetHeadcountFloorViolation = {
  buffetId: string;
  minAdults: number;
  minChildren: number;
  proposedAdults: number;
  proposedChildren: number;
};

/**
 * Returns the first buffet whose proposed headcount falls below a paid-allocation floor.
 * Missing packages in `target` count as 0/0 (void).
 */
export function findBuffetHeadcountBelowPaidFloor(
  target: BuffetGuestSnapshot,
  floors: Map<string, BuffetGuestCounts>,
): BuffetHeadcountFloorViolation | null {
  for (const [buffetId, floor] of Array.from(floors.entries())) {
    const proposed = target[buffetId] ?? { adults: 0, children: 0 };
    if (proposed.adults < floor.adults || proposed.children < floor.children) {
      return {
        buffetId,
        minAdults: floor.adults,
        minChildren: floor.children,
        proposedAdults: proposed.adults,
        proposedChildren: proposed.children,
      };
    }
  }
  return null;
}

export const BUFFET_HEADCOUNT_BELOW_PAID_FLOOR = 'buffet_headcount_below_paid_floor' as const;
