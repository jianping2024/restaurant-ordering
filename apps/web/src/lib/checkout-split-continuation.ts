import {
  buildByItemAllocationsFromPersons,
  createByItemConsumerRow,
  rationalToRowQtyFields,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { rationalsEqual, type Rational } from '@/lib/rational-qty';
import type { BillSplit, SplitMode, SplitPerson } from '@/types';
import type { CheckoutRequestPayload } from '@/lib/checkout-request-payload';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectedPersonNames } from '@/lib/checkout-session-payments';

export type CheckoutContinuationIssue =
  | 'split_mode_locked'
  | 'locked_allocation_changed'
  | 'split_shape_locked';

/** Locked split row count from persisted persons or result snapshot. */
export function lockedSplitRowCount(split: BillSplit | null | undefined): number {
  if (!split) return 0;
  return Math.max(split.persons?.length ?? 0, split.result?.length ?? 0);
}

export type ContinuationSplitShape = {
  personCount: number;
  personNames: string[];
};

/** Hydrate even/custom draft shape from a paused continuation split. */
export function resolveContinuationSplitShape(
  split: BillSplit | null | undefined,
  guestName: (n: number) => string,
): ContinuationSplitShape | null {
  if (!split) return null;
  const count = lockedSplitRowCount(split);
  if (count < 1) return null;

  const personNames: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const fromResult = split.result?.[i]?.name?.trim();
    const fromPerson = split.persons?.[i]?.name?.trim();
    personNames.push(fromResult || fromPerson || guestName(i + 1));
  }

  return {
    personCount: split.split_mode === 'even' ? Math.max(2, count) : count,
    personNames,
  };
}

/** Session has at least one confirmed per-person payment on the active split. */
export function hasPaidSplitRow(split: BillSplit | null | undefined): boolean {
  return (split?.result ?? []).some((row) => !!row.paid);
}

/** Checkout was paused for more ordering while keeping split snapshot (resume after partial pay). */
export function isPausedCheckoutSplit(
  split: BillSplit | null | undefined,
  sessionStatus: string | null | undefined,
): boolean {
  return sessionStatus === 'open' && split?.status === 'confirmed';
}

/** Split plan must not change after partial collection has started. */
export function isCheckoutSplitLocked(
  split: BillSplit | null | undefined,
  hasCollectedLedger = false,
): boolean {
  if (!split) return false;
  if (hasPaidSplitRow(split)) return true;
  if (hasCollectedLedger) return true;
  return false;
}

/** Guests with collection history on this session (case-insensitive). */
export function allocationLockedPersonNames(
  split: BillSplit | null | undefined,
  collectedPayments: SessionCollectedPayment[] = [],
): ReadonlySet<string> {
  const names = new Set(collectedPersonNames(collectedPayments));
  for (const name of Array.from(paidSplitPersonNames(split))) {
    names.add(name);
  }
  return names;
}

/** Guests who already paid on the active split (case-insensitive). */
export function paidSplitPersonNames(split: BillSplit | null | undefined): ReadonlySet<string> {
  return new Set(
    (split?.result ?? [])
      .filter((row) => row.paid)
      .map((row) => row.name.trim().toLowerCase()),
  );
}

/** Bill page shows post-request success only while checkout is actively requested. */
export function shouldShowCheckoutSubmitted(
  split: BillSplit | null | undefined,
  sessionStatus: string | null | undefined,
): boolean {
  if (!split) return false;
  if (split.status === 'requested') return true;
  if (isPausedCheckoutSplit(split, sessionStatus)) return false;
  return split.status === 'pending';
}

/**
 * By-item line keys that must stay read-only after collection starts.
 * Locks paid guests' shares; when ledger exists without per-row paid flags, locks all prior shares.
 */
export function lockedByItemLineKeys(
  split: BillSplit | null | undefined,
  hasCollectedLedger = false,
  collectedPayments: SessionCollectedPayment[] = [],
): Set<string> {
  const keys = new Set<string>();
  if (!split || split.split_mode !== 'by_item') return keys;

  const lockedNames = allocationLockedPersonNames(split, collectedPayments);
  const lockAllAssignedShares = hasCollectedLedger && lockedNames.size === 0;

  for (const person of split.persons ?? []) {
    const isLockedPerson = lockedNames.has(person.name.trim().toLowerCase());
    if (!lockAllAssignedShares && !isLockedPerson) continue;
    for (const share of person.item_shares ?? []) {
      if (share.key) keys.add(share.key);
    }
    for (const key of person.items ?? []) {
      keys.add(key);
    }
  }
  return keys;
}

function buffetRowsFromShares(
  shares: Array<{ name: string; qty: Rational; guestType?: 'adult' | 'child' }>,
): ByItemConsumerRow[] {
  const byName = new Map<string, { adults: number; children: number }>();
  for (const share of shares) {
    const name = share.name.trim();
    if (!name) continue;
    const entry = byName.get(name) ?? { adults: 0, children: 0 };
    const count = Math.round(share.qty.num / share.qty.den);
    if (share.guestType === 'child') entry.children += count;
    else entry.adults += count;
    byName.set(name, entry);
  }
  return Array.from(byName.entries()).map(([name, counts]) => ({
    ...createByItemConsumerRow({ buffet: true }),
    name,
    adultQty: counts.adults > 0 ? String(counts.adults) : '',
    childQty: counts.children > 0 ? String(counts.children) : '',
    qtyWhole: '',
    qtyNum: '',
    qtyDen: '',
  }));
}

/** Hydrate ByItem UI rows from persisted split persons. */
export function buildByItemConsumerRowsFromPersons(
  persons: SplitPerson[],
  lineSpecs: ByItemLineSpec[],
): Record<string, ByItemConsumerRow[]> {
  const allocations = buildByItemAllocationsFromPersons(persons, lineSpecs);
  const rows: Record<string, ByItemConsumerRow[]> = {};
  for (const spec of lineSpecs) {
    const shares = allocations[spec.key];
    if (!shares?.length) continue;
    if (spec.mode === 'buffet') {
      rows[spec.key] = buffetRowsFromShares(shares);
      continue;
    }
    rows[spec.key] = shares.map((share) => ({
      ...createByItemConsumerRow(),
      name: share.name,
      ...rationalToRowQtyFields(share.qty),
    }));
  }
  return rows;
}

function allocationsEqualForKey(
  left: ByItemLineAllocation[string] | undefined,
  right: ByItemLineAllocation[string] | undefined,
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x.name.localeCompare(y.name));
  const sortedB = [...b].sort((x, y) => x.name.localeCompare(y.name));
  for (let i = 0; i < sortedA.length; i += 1) {
    const rowA = sortedA[i];
    const rowB = sortedB[i];
    if (rowA.name.trim() !== rowB.name.trim()) return false;
    if (!rationalsEqual(rowA.qty, rowB.qty)) return false;
    if ((rowA.guestType ?? '') !== (rowB.guestType ?? '')) return false;
  }
  return true;
}

export function validateCheckoutContinuation(params: {
  existing: BillSplit;
  payload: CheckoutRequestPayload;
  lineSpecs: ByItemLineSpec[];
  hasCollectedLedger: boolean;
  collectedPayments?: SessionCollectedPayment[];
}): { ok: true } | { ok: false; issue: CheckoutContinuationIssue } {
  const { existing, payload, lineSpecs, hasCollectedLedger, collectedPayments = [] } = params;
  if (!isCheckoutSplitLocked(existing, hasCollectedLedger)) {
    return { ok: true };
  }

  const existingMode: SplitMode | null =
    existing.split_mode === 'even' || existing.split_mode === 'by_item' || existing.split_mode === 'custom'
      ? existing.split_mode
      : null;
  const incomingMode = payload.splitMode;
  if (existingMode && incomingMode !== existingMode) {
    return { ok: false, issue: 'split_mode_locked' };
  }

  if (existing.split_mode === 'by_item' && incomingMode === 'by_item') {
    const lockedKeys = lockedByItemLineKeys(existing, hasCollectedLedger, collectedPayments);
    if (lockedKeys.size === 0) return { ok: true };
    const existingAlloc = buildByItemAllocationsFromPersons(existing.persons ?? [], lineSpecs);
    const incomingAlloc = buildByItemAllocationsFromPersons(payload.persons, lineSpecs);
    for (const key of Array.from(lockedKeys)) {
      if (!allocationsEqualForKey(existingAlloc[key], incomingAlloc[key])) {
        return { ok: false, issue: 'locked_allocation_changed' };
      }
    }
    return { ok: true };
  }

  if (
    hasCollectedLedger
    && (existing.split_mode === 'even' || existing.split_mode === 'custom')
  ) {
    const existingCount = lockedSplitRowCount(existing);
    if (existingCount > 0 && payload.result.length !== existingCount) {
      return { ok: false, issue: 'split_shape_locked' };
    }
  }

  return { ok: true };
}
