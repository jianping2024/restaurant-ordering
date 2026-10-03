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
  sumCollectedByPersonIndex,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import {
  allocateDiscountedSplitObligations,
} from '@/lib/checkout-split-math';
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
  /** Bill `total_amount` — payable basis when set. */
  billTotalAmount?: number;
  /** @deprecated Ignored — kept so call sites need not fork. */
  billPending?: number;
}): ByItemCollectTarget | null {
  const key = splitPartyKey(params.partyId, params.personName);
  if (!key) return null;

  const index = params.roster.findIndex((row) => splitResultTicketKey(row) === key);
  if (index < 0) return null;

  const discountRate = params.discountRate ?? 0;
  const preAmounts = params.roster.map((row) => {
    const live = params.liveResults.find((r) => splitResultTicketKey(r) === splitResultTicketKey(row));
    return live?.amount ?? row.amount ?? 0;
  });
  const preDiscountObligation = preAmounts[index] ?? 0;
  const collectedByIndex = sumCollectedByPersonIndex(params.collectedPayments);
  const obligations = allocateDiscountedSplitObligations(preAmounts, discountRate, {
    billTotalAmount: params.billTotalAmount,
  });
  const discountedObligation = obligations[index] ?? 0;
  const prior = collectedByIndex.get(index) ?? 0;
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
  billTotalAmount?: number,
): ReadonlySet<string> {
  const rows = buildSplitSettlementRows(
    roster.map((row) => ({
      name: row.name,
      amount: row.amount,
      ...(row.party_id?.trim() ? { party_id: row.party_id.trim() } : {}),
    })),
    collectedPayments,
    discountRate,
    billTotalAmount,
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
 * Sole unpaid by-item plan sync into the ledger.
 * One ticket roster: `persons[i]` and `result[i]` are always the same party key.
 * Order prefers existing `result` (keeps person_index stable), then new draft tickets.
 * Paid amounts stay frozen; unlocked / locked-but-unpaid amounts come from draftResults.
 * Resume flush and collect (after stamp) both call this — not a second merge.
 */
export function mergeStaffByItemUnpaidDraftIntoLedger(params: {
  existingPersons: ReadonlyArray<SplitPerson>;
  existingResult: ReadonlyArray<SplitResult>;
  draftPersons: ReadonlyArray<SplitPerson>;
  draftResults: ReadonlyArray<SplitResult>;
  lockedTicketKeys: ReadonlySet<string>;
}): { persons: SplitPerson[]; result: SplitResult[] } {
  const locked = params.lockedTicketKeys;

  const existingPersonByKey = new Map<string, SplitPerson>();
  for (const row of params.existingPersons) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitPartyKey(row.party_id, row.name);
    if (!key || existingPersonByKey.has(key)) continue;
    existingPersonByKey.set(key, row);
  }

  const existingResultByKey = new Map<string, SplitResult>();
  for (const row of params.existingResult) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitResultTicketKey(row);
    if (!key || existingResultByKey.has(key)) continue;
    existingResultByKey.set(key, row);
  }

  const draftPersonByKey = new Map<string, SplitPerson>();
  /** Explicit empty draft rows — drop these unpaid tickets; omit ≠ drop. */
  const draftExplicitEmptyKeys = new Set<string>();
  for (const row of params.draftPersons) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitPartyKey(row.party_id, row.name);
    if (!key) continue;
    if ((row.item_shares?.length ?? 0) === 0) {
      draftExplicitEmptyKeys.add(key);
      continue;
    }
    draftPersonByKey.set(key, row);
  }

  const draftResultByKey = new Map<string, SplitResult>();
  for (const row of params.draftResults) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitResultTicketKey(row);
    if (!key) continue;
    draftResultByKey.set(key, toWireSplitResult(row));
  }

  const unpaidKeys = new Set<string>();
  for (const key of Array.from(draftPersonByKey.keys())) {
    if (!locked.has(key)) unpaidKeys.add(key);
  }
  // Keep ledger unpaid tickets that still have shares when the draft omitted them
  // (incomplete UI hydrate). Explicit empty draft rows still drop (Jim→Marry).
  for (const row of params.existingPersons) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitPartyKey(row.party_id, row.name);
    if (!key || locked.has(key) || draftExplicitEmptyKeys.has(key)) continue;
    if ((row.item_shares?.length ?? 0) === 0) continue;
    if (draftPersonByKey.has(key)) continue;
    unpaidKeys.add(key);
  }

  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  const pushKey = (key: string | null | undefined) => {
    if (!key || seen.has(key)) return;
    const keep = locked.has(key) || unpaidKeys.has(key);
    if (!keep) return;
    seen.add(key);
    orderedKeys.push(key);
  };

  for (const row of params.existingResult) {
    if (isWholeTablePayerName(row.name)) continue;
    pushKey(splitResultTicketKey(row));
  }
  for (const row of params.draftResults) {
    if (isWholeTablePayerName(row.name)) continue;
    pushKey(splitResultTicketKey(row));
  }
  for (const row of params.existingPersons) {
    if (isWholeTablePayerName(row.name)) continue;
    pushKey(splitPartyKey(row.party_id, row.name));
  }

  const persons: SplitPerson[] = [];
  const result: SplitResult[] = [];

  for (const key of orderedKeys) {
    const isLocked = locked.has(key);
    const draftPerson = draftPersonByKey.get(key);
    const existingPerson = existingPersonByKey.get(key);
    const draftResult = draftResultByKey.get(key);
    const existingResultRow = existingResultByKey.get(key);

    if (isLocked) {
      const person = draftPerson ?? existingPerson;
      if (!person) continue;
      const paid = Boolean(existingResultRow?.paid);
      // Paid: freeze ledger amount. Locked-but-unpaid: refresh from draft (share truth).
      const amount = paid
        ? Number(existingResultRow?.amount ?? draftResult?.amount ?? 0)
        : Number(draftResult?.amount ?? existingResultRow?.amount ?? 0);
      const partyId = person.party_id?.trim() || existingResultRow?.party_id?.trim();
      persons.push(person);
      result.push(
        toWireSplitResult({
          name: person.name,
          amount,
          paid,
          partyId,
        }),
      );
      continue;
    }

    const person = draftPerson ?? existingPerson;
    if (!person || (person.item_shares?.length ?? 0) === 0) continue;
    const amount = Number(
      draftResult?.amount ?? existingResultRow?.amount ?? person.amount ?? 0,
    );
    const partyId =
      person.party_id?.trim() ||
      draftResult?.party_id?.trim() ||
      existingResultRow?.party_id?.trim();
    persons.push(person);
    result.push(
      toWireSplitResult({
        name: person.name,
        amount,
        paid: false,
        partyId,
      }),
    );
  }

  if (persons.length === 0) {
    // No unpaid draft shares written: keep locked + unpaid-with-shares from existing;
    // never re-inject unpaid empty tickets (resume must drop them).
    return pruneUnpaidEmptyByItemTickets({
      persons: params.existingPersons,
      result: params.existingResult,
      lockedTicketKeys: locked,
    });
  }
  return { persons, result };
}

/**
 * Sole by-item empty-ticket prune: drop unpaid tickets with no item_shares.
 * Locked tickets stay even when shares are empty; paid flag follows existing result.
 */
export function pruneUnpaidEmptyByItemTickets(params: {
  persons: readonly SplitPerson[];
  result: readonly SplitResult[];
  lockedTicketKeys: ReadonlySet<string>;
}): { persons: SplitPerson[]; result: SplitResult[]; changed: boolean } {
  const locked = params.lockedTicketKeys;
  const personByKey = new Map<string, SplitPerson>();
  for (const row of params.persons) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitPartyKey(row.party_id, row.name);
    if (!key || personByKey.has(key)) continue;
    personByKey.set(key, row);
  }

  const keepKeys = new Set<string>();
  for (const [key, person] of Array.from(personByKey.entries())) {
    if (locked.has(key) || (person.item_shares?.length ?? 0) > 0) {
      keepKeys.add(key);
    }
  }
  for (const row of params.result) {
    if (isWholeTablePayerName(row.name)) continue;
    const key = splitResultTicketKey(row);
    if (!key) continue;
    if (locked.has(key) || row.paid) keepKeys.add(key);
  }

  const persons: SplitPerson[] = [];
  const result: SplitResult[] = [];
  const seen = new Set<string>();
  const pushKey = (key: string | null | undefined) => {
    if (!key || seen.has(key) || !keepKeys.has(key)) return;
    seen.add(key);
    const person = personByKey.get(key);
    const existingResult = params.result.find(
      (row) => splitResultTicketKey(row) === key,
    );
    if (!person && !existingResult) return;
    const name = person?.name ?? existingResult?.name ?? '';
    if (!name || isWholeTablePayerName(name)) return;
    const partyId =
      person?.party_id?.trim() || existingResult?.party_id?.trim() || undefined;
    persons.push(
      person ?? {
        name,
        item_shares: [],
        ...(partyId ? { party_id: partyId } : {}),
      },
    );
    result.push(
      toWireSplitResult({
        name,
        amount: Number(existingResult?.amount ?? person?.amount ?? 0),
        paid: Boolean(existingResult?.paid),
        partyId,
      }),
    );
  };

  for (const row of params.result) {
    if (isWholeTablePayerName(row.name)) continue;
    pushKey(splitResultTicketKey(row));
  }
  for (const row of params.persons) {
    if (isWholeTablePayerName(row.name)) continue;
    pushKey(splitPartyKey(row.party_id, row.name));
  }

  const changed =
    persons.length !== params.persons.filter((p) => !isWholeTablePayerName(p.name)).length ||
    result.length !==
      params.result.filter((r) => !isWholeTablePayerName(r.name)).length;

  return { persons, result, changed };
}

/** True when live outstanding still matches the modal amount (cent-equal). */
export function collectModalAmountStillValid(
  liveOutstanding: number,
  modalAmount: number,
): boolean {
  return eurosToCents(liveOutstanding) === eurosToCents(modalAmount);
}
