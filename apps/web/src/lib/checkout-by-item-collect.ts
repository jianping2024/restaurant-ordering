/**
 * Sole by-item staff collect targeting: roster person_index + live amount,
 * clamped to bill pending; collected obligation floors on merge/submit.
 */
import {
  getByItemLineStatusFromShares,
  isByItemLineComplete,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  outstandingAmount,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import { buildSplitSettlementRows } from '@/lib/checkout-split-settlement';
import { eurosToCents } from '@/lib/money-allocation';
import { splitPersonKey } from '@/lib/split-person-identity';
import { staffByItemLedgerPersonNames } from '@/lib/staff-by-item-people';
import type { SplitResult } from '@/types';

/** True when every by-item catalog line is fully allocated (pool empty). */
export function byItemPoolFullyAllocated(
  lineSpecs: ByItemLineSpec[],
  allocations: ByItemLineAllocation,
): boolean {
  if (lineSpecs.length === 0) return false;
  for (const spec of lineSpecs) {
    const status = getByItemLineStatusFromShares(spec, allocations[spec.key] ?? []);
    if (!isByItemLineComplete(status)) return false;
  }
  return true;
}

/**
 * Sole staff by-item edit/collect roster while drafting:
 * - whole-table / empty ledger → live draft results only
 * - confirmed by-item ledger names → live amounts ordered to ledger (then new guests)
 */
export function resolveStaffByItemEditRoster(params: {
  ledgerResults: ReadonlyArray<{ name: string; amount: number }>;
  liveResults: ReadonlyArray<{ name: string; amount: number }>;
}): SplitResult[] {
  const ledgerNames = staffByItemLedgerPersonNames(
    params.ledgerResults.map((row) => row.name),
  );
  if (ledgerNames.length === 0) {
    return params.liveResults.map((row) => ({
      name: row.name,
      amount: row.amount,
    }));
  }
  return orderByItemResultsToRoster(params.liveResults, ledgerNames);
}

/**
 * Order live by-item rows to match the ledger roster (`bill_splits.result` order).
 * Append unknown names after roster — never localeCompare-sort for person_index.
 */
export function orderByItemResultsToRoster(
  liveResults: ReadonlyArray<{ name: string; amount: number }>,
  rosterNames: readonly string[],
): SplitResult[] {
  const byKey = new Map<string, { name: string; amount: number }>();
  for (const row of liveResults) {
    const key = splitPersonKey(row.name);
    if (!key) continue;
    byKey.set(key, { name: row.name, amount: row.amount });
  }
  const used = new Set<string>();
  const ordered: SplitResult[] = [];
  for (const name of rosterNames) {
    const key = splitPersonKey(name);
    if (!key || used.has(key)) continue;
    const live = byKey.get(key);
    ordered.push({
      name: live?.name ?? name,
      amount: live?.amount ?? 0,
    });
    used.add(key);
  }
  for (const row of liveResults) {
    const key = splitPersonKey(row.name);
    if (!key || used.has(key)) continue;
    used.add(key);
    ordered.push({ name: row.name, amount: row.amount });
  }
  return ordered;
}

/** Collected euros keyed by splitPersonKey(person_name); index used when name empty. */
export function collectedTotalsByPersonKey(
  payments: SessionCollectedPayment[],
  roster: ReadonlyArray<{ name: string }>,
): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const payment of payments) {
    const fromName = splitPersonKey(payment.person_name);
    const fromIndex =
      payment.person_index != null && payment.person_index >= 0
        ? splitPersonKey(roster[payment.person_index]?.name ?? '')
        : '';
    const key = fromName || fromIndex;
    if (!key) continue;
    byKey.set(key, (byKey.get(key) ?? 0) + Number(payment.amount || 0));
  }
  return byKey;
}

/**
 * Sole obligation floor after collection: amount may rise with new shares,
 * never fall below what this person already paid into the ledger.
 */
export function applyCollectedObligationFloors(
  results: SplitResult[],
  payments: SessionCollectedPayment[],
): SplitResult[] {
  if (payments.length === 0) return results;
  const collected = collectedTotalsByPersonKey(payments, results);
  return results.map((row) => {
    const key = splitPersonKey(row.name);
    const floor = key ? collected.get(key) ?? 0 : 0;
    if (floor <= 0) return row;
    if (eurosToCents(row.amount) >= eurosToCents(floor)) return row;
    return { ...row, amount: floor };
  });
}

export type ByItemCollectTarget = {
  index: number;
  amount: number;
  personName: string;
};

/**
 * Sole staff by-item collect target:
 * - person_index = index in roster (`bill_splits.result` order)
 * - amount = live obligation outstanding for that person (应付 − 已收)
 * Does not clamp to bill pending — person math must already match the bill.
 */
export function resolveByItemCollectTarget(params: {
  personName: string;
  /** Stable ledger order — usually `bill_splits.result` names (then new guests). */
  roster: ReadonlyArray<{ name: string; amount?: number }>;
  /** Live calc rows (any order); matched by name. */
  liveResults: ReadonlyArray<{ name: string; amount: number }>;
  collectedPayments: SessionCollectedPayment[];
  /** @deprecated Ignored — kept so call sites need not fork. */
  billPending?: number;
}): ByItemCollectTarget | null {
  const key = splitPersonKey(params.personName);
  if (!key) return null;

  const index = params.roster.findIndex((row) => splitPersonKey(row.name) === key);
  if (index < 0) return null;

  const live = params.liveResults.find((row) => splitPersonKey(row.name) === key);
  const obligation = live?.amount ?? params.roster[index]?.amount ?? 0;
  const prior = params.collectedPayments
    .filter(
      (payment) =>
        splitPersonKey(payment.person_name) === key ||
        (payment.person_index === index && !splitPersonKey(payment.person_name)),
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amount = outstandingAmount(obligation, prior);
  if (amount <= 0) return null;

  return {
    index,
    amount,
    personName: params.roster[index]?.name ?? params.personName,
  };
}

/** Settled person keys (ledger covers obligation) — sole chip ✓ / hide-collect gate. */
export function settledByItemPersonKeys(
  roster: ReadonlyArray<{ name: string; amount: number }>,
  collectedPayments: SessionCollectedPayment[],
): ReadonlySet<string> {
  const rows = buildSplitSettlementRows(
    roster.map((row) => ({ name: row.name, amount: row.amount })),
    collectedPayments,
  );
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.settlementStatus !== 'settled') continue;
    const key = splitPersonKey(row.name);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * After obligation floors, force Σ(result)=bill total without lowering anyone
 * below their ledger collected (trim/add unsettled rows from the end).
 */
export function reconcileByItemResultsToBillTotal(
  results: SplitResult[],
  billTotal: number,
  payments: SessionCollectedPayment[],
): SplitResult[] {
  const floored = applyCollectedObligationFloors(results, payments);
  const collected = collectedTotalsByPersonKey(payments, floored);
  const target = eurosToCents(billTotal);
  const sum = floored.reduce((acc, row) => acc + eurosToCents(row.amount), 0);
  if (sum === target) return floored;

  const next = floored.map((row) => ({ ...row }));
  if (sum > target) {
    let excess = sum - target;
    for (let i = next.length - 1; i >= 0 && excess > 0; i -= 1) {
      const key = splitPersonKey(next[i]!.name);
      const floor = key ? eurosToCents(collected.get(key) ?? 0) : 0;
      const amt = eurosToCents(next[i]!.amount);
      const reducible = amt - floor;
      if (reducible <= 0) continue;
      const take = Math.min(reducible, excess);
      next[i] = { ...next[i]!, amount: (amt - take) / 100 };
      excess -= take;
    }
    return next;
  }

  let missing = target - sum;
  for (let i = next.length - 1; i >= 0 && missing > 0; i -= 1) {
    const key = splitPersonKey(next[i]!.name);
    const floor = key ? collected.get(key) ?? 0 : 0;
    // Prefer rows still open (not fully covered by ledger).
    const amt = eurosToCents(next[i]!.amount);
    if (floor > 0 && amt <= eurosToCents(floor)) continue;
    next[i] = { ...next[i]!, amount: (amt + missing) / 100 };
    missing = 0;
  }
  if (missing > 0 && next.length > 0) {
    const last = next[next.length - 1]!;
    next[next.length - 1] = {
      ...last,
      amount: (eurosToCents(last.amount) + missing) / 100,
    };
  }
  return next;
}
