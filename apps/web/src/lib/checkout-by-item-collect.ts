/**
 * Sole by-item staff collect targeting: roster person_index + live amount.
 * Ticket identity: {@link splitPartyKey} (party_id when present, else name).
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
import { discountedObligationAmount } from '@/lib/checkout-split-math';
import { buildSplitSettlementRows } from '@/lib/checkout-split-settlement';
import { eurosToCents } from '@/lib/money-allocation';
import { isWholeTablePayerName } from '@/lib/split-person-label';
import { splitPartyKey, splitResultTicketKey, toWireSplitResult } from '@/lib/split-party-id';
import {
  staffByItemLedgerPeople,
  type StaffByItemRailPerson,
} from '@/lib/staff-by-item-people';
import type { SplitPerson, SplitResult } from '@/types';

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
 * - confirmed by-item ledger → live amounts ordered to ledger (then new tickets)
 */
export function resolveStaffByItemEditRoster(params: {
  ledgerResults: ReadonlyArray<SplitResult>;
  liveResults: ReadonlyArray<SplitResult>;
}): SplitResult[] {
  const ledgerPeople = staffByItemLedgerPeople(
    params.ledgerResults.map((row) => ({
      name: row.name,
      ...(row.party_id?.trim() ? { partyId: row.party_id.trim() } : {}),
    })),
  );
  if (ledgerPeople.length === 0) {
    return params.liveResults.map((row) => toWireSplitResult(row));
  }
  return orderByItemResultsToRoster(params.liveResults, ledgerPeople);
}

/**
 * Order live by-item rows to match the ledger roster (`bill_splits.result` order).
 * Append unknown tickets after roster — never localeCompare-sort for person_index.
 */
export function orderByItemResultsToRoster(
  liveResults: ReadonlyArray<SplitResult>,
  rosterPeople: ReadonlyArray<StaffByItemRailPerson>,
): SplitResult[] {
  const byKey = new Map<string, SplitResult>();
  for (const row of liveResults) {
    const key = splitResultTicketKey(row);
    if (!key) continue;
    byKey.set(key, toWireSplitResult(row));
  }
  const used = new Set<string>();
  const ordered: SplitResult[] = [];
  for (const person of rosterPeople) {
    const key = splitPartyKey(person.partyId, person.name);
    if (!key || used.has(key)) continue;
    const live = byKey.get(key);
    ordered.push(
      toWireSplitResult({
        name: live?.name ?? person.name,
        amount: live?.amount ?? 0,
        partyId: person.partyId ?? live?.party_id,
      }),
    );
    used.add(key);
  }
  for (const row of liveResults) {
    const key = splitResultTicketKey(row);
    if (!key || used.has(key)) continue;
    used.add(key);
    ordered.push(toWireSplitResult(row));
  }
  return ordered;
}

/** Collected euros keyed by ticket key; index used when name empty. */
export function collectedTotalsByPersonKey(
  payments: SessionCollectedPayment[],
  roster: ReadonlyArray<SplitResult>,
): Map<string, number> {
  const byKey = new Map<string, number>();
  for (const payment of payments) {
    const fromIndex =
      payment.person_index != null && payment.person_index >= 0
        ? splitResultTicketKey(roster[payment.person_index] ?? { name: '' })
        : '';
    const fromName = splitPartyKey(undefined, payment.person_name);
    const key = fromIndex || fromName;
    if (!key) continue;
    byKey.set(key, (byKey.get(key) ?? 0) + Number(payment.amount || 0));
  }
  return byKey;
}

/**
 * Sole obligation floor after collection: amount may rise with new shares,
 * never fall below what this ticket already paid into the ledger.
 */
export function applyCollectedObligationFloors(
  results: SplitResult[],
  payments: SessionCollectedPayment[],
): SplitResult[] {
  if (payments.length === 0) return results;
  const collected = collectedTotalsByPersonKey(payments, results);
  return results.map((row) => {
    const key = splitResultTicketKey(row);
    const floor = key ? collected.get(key) ?? 0 : 0;
    if (floor <= 0) return row;
    if (eurosToCents(row.amount) >= eurosToCents(floor)) return row;
    return { ...row, amount: floor };
  });
}

export type ByItemCollectTarget = {
  index: number;
  /** Outstanding to collect now (折后义务 − 已收). */
  amount: number;
  /** Ticket pre-discount obligation (collect modal discount context). */
  preDiscountObligation: number;
  personName: string;
  partyId?: string;
};

/**
 * Sole staff by-item collect target:
 * - person_index = index in roster (`bill_splits.result` order)
 * - amount = discountedObligation(折前票应付) − 当前票历史已收
 * Open-modal and confirm-before-pay must both call this (never discount again outside).
 */
export function resolveByItemCollectTarget(params: {
  personName: string;
  partyId?: string;
  /** Stable ledger order — usually `bill_splits.result` (then new tickets). */
  roster: ReadonlyArray<SplitResult>;
  /** Live calc rows (any order); matched by ticket key — pre-discount obligations. */
  liveResults: ReadonlyArray<SplitResult>;
  collectedPayments: SessionCollectedPayment[];
  /** Bill-level discount %; default 0. */
  discountRate?: number;
  /** @deprecated Ignored — kept so call sites need not fork. */
  billPending?: number;
}): ByItemCollectTarget | null {
  const key = splitPartyKey(params.partyId, params.personName);
  if (!key) return null;

  const index = params.roster.findIndex((row) => splitResultTicketKey(row) === key);
  if (index < 0) return null;

  const live = params.liveResults.find((row) => splitResultTicketKey(row) === key);
  const preDiscountObligation = live?.amount ?? params.roster[index]?.amount ?? 0;
  const discountedObligation = discountedObligationAmount(
    preDiscountObligation,
    params.discountRate ?? 0,
  );
  const prior = params.collectedPayments
    .filter(
      (payment) =>
        payment.person_index === index ||
        (splitPartyKey(undefined, payment.person_name) === key &&
          (payment.person_index == null || payment.person_index < 0)),
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const amount = outstandingAmount(discountedObligation, prior);
  if (amount <= 0) return null;

  const rosterRow = params.roster[index]!;
  return {
    index,
    amount,
    preDiscountObligation,
    personName: rosterRow.name ?? params.personName,
    ...(rosterRow.party_id?.trim()
      ? { partyId: rosterRow.party_id.trim() }
      : params.partyId?.trim()
        ? { partyId: params.partyId.trim() }
        : {}),
  };
}

/** Settled ticket keys (ledger covers obligation) — sole chip ✓ / hide-collect gate. */
export function settledByItemPersonKeys(
  roster: ReadonlyArray<SplitResult>,
  collectedPayments: SessionCollectedPayment[],
  discountRate = 0,
): ReadonlySet<string> {
  const rows = buildSplitSettlementRows(
    roster.map((row) => ({
      name: row.name,
      amount: row.amount,
      ...(row.party_id?.trim() ? { party_id: row.party_id.trim() } : {}),
    })),
    collectedPayments,
    discountRate,
  );
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.settlementStatus !== 'settled') continue;
    const person = roster[row.index];
    const key = splitResultTicketKey(person ?? { name: row.name });
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Sole by-item collect confirm merge: upsert **one** ticket into the ledger.
 * Other tickets keep existing amounts/shares — never whole-table recalculate.
 * Drops whole-table sentinel rows when the first real ticket is written.
 */
export function mergeCurrentByItemTicketForCollect(params: {
  existingPersons: ReadonlyArray<SplitPerson>;
  existingResult: ReadonlyArray<SplitResult>;
  ticketPerson: SplitPerson;
  ticketAmount: number;
}): { persons: SplitPerson[]; result: SplitResult[] } {
  const ticketKey = splitPartyKey(params.ticketPerson.party_id, params.ticketPerson.name);
  if (!ticketKey) {
    return {
      persons: [...params.existingPersons],
      result: [...params.existingResult],
    };
  }

  const ticketResult = toWireSplitResult({
    name: params.ticketPerson.name,
    amount: params.ticketAmount,
    party_id: params.ticketPerson.party_id,
    partyId: params.ticketPerson.party_id,
  });

  const basePersons = params.existingPersons.filter((row) => !isWholeTablePayerName(row.name));
  const baseResult = params.existingResult.filter((row) => !isWholeTablePayerName(row.name));

  let personHit = false;
  const persons = basePersons.map((row) => {
    if (splitPartyKey(row.party_id, row.name) !== ticketKey) return row;
    personHit = true;
    return {
      ...params.ticketPerson,
      // Keep prior amount on person row if present; result is authoritative.
      amount: params.ticketAmount,
    };
  });
  if (!personHit) {
    persons.push({ ...params.ticketPerson, amount: params.ticketAmount });
  }

  let resultHit = false;
  const result = baseResult.map((row) => {
    if (splitResultTicketKey(row) !== ticketKey) return row;
    resultHit = true;
    // Never raise/rewrite an already-paid ticket via collect merge.
    if (row.paid) return row;
    return toWireSplitResult({
      ...ticketResult,
      paid: row.paid,
    });
  });
  if (!resultHit) {
    result.push(ticketResult);
  }

  return { persons, result };
}

/** True when live outstanding still matches the modal amount (cent-equal). */
export function collectModalAmountStillValid(
  liveOutstanding: number,
  modalAmount: number,
): boolean {
  return eurosToCents(liveOutstanding) === eurosToCents(modalAmount);
}
