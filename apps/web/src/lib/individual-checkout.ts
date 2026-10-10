/**
 * Guest per-ticket checkout: each guest phone calls checkout for its own single by-item ticket.
 * Spec: docs/guest-individual-checkout.zh.md (§15).
 *
 * Pure rules shared by the API and the phone UI. Persistence + locks live in the SQL function
 * `individual_checkout_apply`; this module only merges and validates the plan the app sends.
 *
 * Ticket identity is the sole {@link splitResultTicketKey} (party_id first, else name).
 */
import {
  allocateByItemShareAmounts,
  buildByItemAllocationsFromPersons,
  calcByItemSplitResults,
  getByItemLineStatusFromShares,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item';
import {
  byItemSplitLineFromOrderLine,
  type BillSplitOrderLine,
} from '@/lib/bill-split-by-item-lines';
import { fractionUnitConflictLineKeys } from '@/lib/by-item-fraction-unit';
import type { IndividualCheckoutSignalItem } from '@/lib/individual-call-notice';
import { splitPersonKey } from '@/lib/split-person-identity';
import { splitPartyKey, splitResultTicketKey, toWireSplitResult } from '@/lib/split-party-id';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { SplitPerson, SplitResult } from '@/types';

/** Phone-visible state of a ticket in an individual-checkout session. */
type IndividualTicketState = 'called' | 'unlocked';

export type IndividualTicketInfo = {
  ticket_key: string;
  name: string;
  state: IndividualTicketState;
  /** True when the asking phone (guest_client_id) is the one that called it. */
  mine: boolean;
};

/** Sole error vocabulary for call/unlock (API body `error`). */
export type IndividualCheckoutErrorCode =
  | 'claim_conflict'
  | 'by_item_unit_mismatch'
  | 'name_taken'
  | 'empty_ticket'
  | 'invalid_ticket'
  | 'ticket_locked'
  | 'ticket_paid'
  | 'ticket_collecting'
  | 'not_your_ticket'
  | 'ticket_not_found'
  | 'locked_ticket_changed'
  | 'stale_plan'
  | 'split_mode_locked'
  | 'no_active_session'
  | 'invalid_request'
  | 'individual_apply_failed';

type IndividualCallIssue =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'claim_conflict'
        | 'by_item_unit_mismatch'
        | 'name_taken'
        | 'empty_ticket'
        | 'invalid_ticket';
      /** Line keys whose claimed qty exceeds what is left (claim_conflict) or whose fraction unit differs (by_item_unit_mismatch). */
      lineKeys?: string[];
      /** Display names that collide with another unpaid ticket (name_taken). */
      names?: string[];
    };

function personTicketKey(person: Pick<SplitPerson, 'name' | 'party_id'>): string {
  return splitResultTicketKey(person);
}

/**
 * Sole name-collision rule: an unpaid ticket of someone else already uses this name
 * (case-insensitive). A paid ticket never blocks — the name may start a new ticket.
 */
export function unpaidNameTakenByOther(
  result: ReadonlyArray<SplitResult>,
  mine: { key: string; name: string },
): boolean {
  const nameKey = splitPersonKey(mine.name);
  if (!nameKey) return false;
  return result.some(
    (other) =>
      !other.paid &&
      splitResultTicketKey(other) !== mine.key &&
      splitPersonKey(other.name) === nameKey,
  );
}

/** Unique, non-empty ticket keys of result rows (call order). */
export function ticketKeysOfResult(rows: ReadonlyArray<SplitResult>): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    const key = splitResultTicketKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

/**
 * Merge this phone's tickets into the stored plan. Existing tickets keep their position;
 * a re-called ticket is replaced in place; new tickets append. Rows of other tickets are
 * returned byte-identical (SQL rejects any difference).
 */
export function mergeIndividualTickets(params: {
  existingPersons: ReadonlyArray<SplitPerson>;
  existingResult: ReadonlyArray<SplitResult>;
  myPersons: ReadonlyArray<SplitPerson>;
  myResult: ReadonlyArray<SplitResult>;
}): { persons: SplitPerson[]; result: SplitResult[]; myKeys: string[] } {
  const myKeys = ticketKeysOfResult(params.myResult);
  const myKeySet = new Set(myKeys);

  const mergeRows = <T,>(
    existing: ReadonlyArray<T>,
    mine: ReadonlyArray<T>,
    keyOf: (row: T) => string,
  ): T[] => {
    const mineByKey = new Map<string, T>();
    for (const row of mine) {
      const key = keyOf(row);
      if (key && myKeySet.has(key) && !mineByKey.has(key)) mineByKey.set(key, row);
    }
    const placed = new Set<string>();
    const out: T[] = [];
    for (const row of existing) {
      const key = keyOf(row);
      if (key && mineByKey.has(key)) {
        out.push(mineByKey.get(key)!);
        placed.add(key);
      } else {
        out.push(row);
      }
    }
    for (const key of Array.from(mineByKey.keys())) {
      if (!placed.has(key)) out.push(mineByKey.get(key)!);
    }
    return out;
  };

  return {
    persons: mergeRows(params.existingPersons, params.myPersons, personTicketKey),
    result: mergeRows(params.existingResult, params.myResult, splitResultTicketKey),
    myKeys,
  };
}

/**
 * Validate the merged plan for a call. Pure: no I/O.
 * - the call is exactly one ticket and it claims at least one positive share
 * - an unpaid name may not be used by two different tickets (paid tickets do not block)
 * - no dish is claimed beyond its qty (first-come: the stored plan already holds earlier claims)
 * - a dish this ticket claims is cut one way (first-come unit; see `by-item-fraction-unit`)
 */
export function validateIndividualCall(params: {
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  persons: ReadonlyArray<SplitPerson>;
  result: ReadonlyArray<SplitResult>;
  myKeys: ReadonlyArray<string>;
}): IndividualCallIssue {
  const { lineSpecs, persons, result, myKeys } = params;
  if (myKeys.length === 0) return { ok: false, code: 'empty_ticket' };
  // One phone, one ticket: a call never carries more than its own single ticket.
  if (myKeys.length > 1) return { ok: false, code: 'invalid_ticket' };

  const resultByKey = new Map<string, SplitResult>();
  for (const row of result) {
    const key = splitResultTicketKey(row);
    if (key && !resultByKey.has(key)) resultByKey.set(key, row);
  }
  const personByKey = new Map<string, SplitPerson>();
  for (const person of persons) {
    const key = personTicketKey(person);
    if (key && !personByKey.has(key)) personByKey.set(key, person);
  }

  for (const key of myKeys) {
    const row = resultByKey.get(key);
    const person = personByKey.get(key);
    if (!row || !person) return { ok: false, code: 'invalid_ticket' };
    if (!splitPersonKey(row.name)) return { ok: false, code: 'invalid_ticket' };
    const claimsSomething = (person.item_shares ?? []).some(
      (share) => share.qty_num > 0 && share.qty_den > 0,
    );
    if (!claimsSomething || !(row.amount > 0)) return { ok: false, code: 'empty_ticket' };
  }

  const takenNames = myKeys.flatMap((key) => {
    const mine = resultByKey.get(key)!;
    return unpaidNameTakenByOther(result, { key, name: mine.name }) ? [mine.name] : [];
  });
  if (takenNames.length > 0) return { ok: false, code: 'name_taken', names: takenNames };

  const allocations = buildByItemAllocationsFromPersons([...persons], [...lineSpecs]);
  const overLines: string[] = [];
  for (const spec of lineSpecs) {
    const status = getByItemLineStatusFromShares(spec, allocations[spec.key] ?? []);
    if (status.kind === 'over' || status.kind === 'buffet_over') overLines.push(spec.key);
  }
  if (overLines.length > 0) return { ok: false, code: 'claim_conflict', lineKeys: overLines };

  const myLineKeys = new Set(
    persons
      .filter((person) => myKeys.includes(personTicketKey(person)))
      .flatMap((person) => (person.item_shares ?? []).map((share) => share.key)),
  );
  const unitLines = fractionUnitConflictLineKeys(persons, myLineKeys);
  if (unitLines.length > 0) {
    return { ok: false, code: 'by_item_unit_mismatch', lineKeys: unitLines };
  }

  return { ok: true };
}

/**
 * Authoritative amounts for this phone's result rows, recomputed from the merged shares so a
 * client cannot persist a made-up total. Other tickets' rows are returned untouched.
 */
export function recomputeIndividualTicketAmounts(params: {
  orderLines: ReadonlyArray<BillSplitOrderLine>;
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  persons: ReadonlyArray<SplitPerson>;
  result: ReadonlyArray<SplitResult>;
  myKeys: ReadonlyArray<string>;
}): SplitResult[] {
  const { orderLines, lineSpecs, persons, result, myKeys } = params;
  const mine = new Set(myKeys);
  const allocations = buildByItemAllocationsFromPersons([...persons], [...lineSpecs]);
  const calc = calcByItemSplitResults({
    lines: orderLines.map((line) =>
      byItemSplitLineFromOrderLine(line, resolveMenuItemLocalizedName(line, 'pt')),
    ),
    allocations,
    personOrder: result.map((row) => row.name),
    personPartyIds: result.map((row) => row.party_id),
  });
  const amountByKey = new Map<string, number>();
  for (const row of calc) {
    const wire = toWireSplitResult(row);
    amountByKey.set(splitResultTicketKey(wire), wire.amount);
  }
  return result.map((row) => {
    const key = splitResultTicketKey(row);
    if (!key || !mine.has(key)) return row;
    const amount = amountByKey.get(key);
    return amount != null ? { ...row, amount } : row;
  });
}

/**
 * Sole call-notice item stamp for `table_checkout_signals.items`.
 * Same share money path as {@link allocateByItemShareAmounts}; trilingual names from order lines.
 * Object keyed by ticket key for `individual_checkout_apply.p_ticket_signal_items`.
 */
export function buildIndividualCallSignalItemsByTicket(params: {
  orderLines: ReadonlyArray<BillSplitOrderLine>;
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  persons: ReadonlyArray<SplitPerson>;
  ticketKeys: ReadonlyArray<string>;
}): Record<string, IndividualCheckoutSignalItem[]> {
  const { orderLines, lineSpecs, persons, ticketKeys } = params;
  const want = new Set(ticketKeys.filter(Boolean));
  const out: Record<string, IndividualCheckoutSignalItem[]> = {};
  for (const key of Array.from(want)) out[key] = [];

  const allocations = buildByItemAllocationsFromPersons([...persons], [...lineSpecs]);
  const lineByKey = new Map(orderLines.map((line) => [line.key, line]));

  for (const [lineKey, shares] of Object.entries(allocations)) {
    const live = shares.filter((share) => share.qty.num > 0 && share.qty.den > 0);
    if (live.length === 0) continue;
    const catalog = lineByKey.get(lineKey);
    if (!catalog) continue;
    const splitLine = byItemSplitLineFromOrderLine(
      catalog,
      resolveMenuItemLocalizedName(catalog, 'pt'),
    );
    const amounts = allocateByItemShareAmounts(splitLine, live);
    const name_pt = (catalog.name_pt || catalog.name || '').trim();
    const name_en = (catalog.name_en || '').trim();
    const name_zh = (catalog.name_zh || '').trim();

    for (let i = 0; i < live.length; i++) {
      const share = live[i]!;
      const ticketKey = splitPartyKey(share.partyId, share.name);
      if (!ticketKey || !want.has(ticketKey)) continue;
      const amount = amounts[i] ?? 0;
      out[ticketKey]!.push({
        key: lineKey,
        qty_num: share.qty.num,
        qty_den: share.qty.den,
        amount: Math.round(amount * 100) / 100,
        name_pt,
        name_en,
        name_zh,
      });
    }
  }

  return out;
}

/** True when this phone has a called ticket that is not yet paid (blocks ordering). */
export function individualPhoneHoldsOrdering(
  tickets: ReadonlyArray<IndividualTicketInfo>,
  result: ReadonlyArray<SplitResult>,
): boolean {
  const paid = new Set<string>();
  for (const row of result) {
    if (row.paid) {
      const key = splitResultTicketKey(row);
      if (key) paid.add(key);
    }
  }
  return tickets.some(
    (ticket) => ticket.mine && ticket.state === 'called' && !paid.has(ticket.ticket_key),
  );
}
