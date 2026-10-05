/**
 * Individual-checkout claim guard: a dish line may not drop below what called (or paid) tickets
 * already claim. Sole check for every path that shrinks a session's billable lines
 * (waiter item patch, waiter/kitchen decrement + void, buffet headcount save).
 * Spec: docs/guest-individual-checkout.zh.md.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadActiveBillSplitForSession } from '@/lib/checkout-active-bill-split';
import {
  buildByItemAllocationsFromPersons,
  getByItemLineStatusFromShares,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import { deriveBillView } from '@/lib/customer-bill-sync';
import { loadCalledTicketKeys } from '@/lib/individual-checkout-reads';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import { splitResultTicketKey } from '@/lib/split-party-id';
import type { Order, SplitPerson, SplitResult } from '@/types';

type ClaimGuardResult = { ok: true } | { ok: false; lineKeys: string[] };

/** Pure: lines whose claim-holding tickets exceed the (possibly reduced) line qty. */
export function claimBreakLineKeys(params: {
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  persons: ReadonlyArray<SplitPerson>;
  /** Ticket keys that hold a claim (called or paid). */
  holdingKeys: ReadonlySet<string>;
}): string[] {
  const { lineSpecs, persons, holdingKeys } = params;
  const holding = persons.filter((person) =>
    holdingKeys.has(splitResultTicketKey(person)),
  );
  if (holding.length === 0) return [];

  const specKeys = new Set(lineSpecs.map((spec) => spec.key));
  const broken = new Set<string>();
  for (const person of holding) {
    for (const share of person.item_shares ?? []) {
      if (share.key && !specKeys.has(share.key)) broken.add(share.key);
    }
  }
  const allocations = buildByItemAllocationsFromPersons([...holding], [...lineSpecs]);
  for (const spec of lineSpecs) {
    const status = getByItemLineStatusFromShares(spec, allocations[spec.key] ?? []);
    if (status.kind === 'over' || status.kind === 'buffet_over') broken.add(spec.key);
  }
  return Array.from(broken);
}

/**
 * Check an order change against the live plan. `nextOrders` is the session's orders as they
 * would be after the write.
 */
export async function guardIndividualClaims(
  admin: SupabaseClient,
  params: {
    restaurantId: string;
    sessionId: string | null | undefined;
    nextOrders: (current: Order[]) => Order[];
  },
): Promise<ClaimGuardResult> {
  const { restaurantId, sessionId } = params;
  if (!sessionId) return { ok: true };

  const split = await loadActiveBillSplitForSession({ admin, restaurantId, sessionId });
  if (!split || split.split_mode !== 'by_item') return { ok: true };
  const persons = Array.isArray(split.persons) ? (split.persons as SplitPerson[]) : [];
  if (persons.length === 0) return { ok: true };

  const holdingKeys = new Set<string>(
    Array.from(await loadCalledTicketKeys(admin, split.id)),
  );
  for (const row of (split.result ?? []) as SplitResult[]) {
    if (row.paid) {
      const key = splitResultTicketKey(row);
      if (key) holdingKeys.add(key);
    }
  }
  if (holdingKeys.size === 0) return { ok: true };

  const current = await loadCustomerSessionOrders({
    admin,
    restaurantId,
    sessionId,
    ascending: true,
  });
  const view = deriveBillView(params.nextOrders(current));
  const lineKeys = claimBreakLineKeys({
    lineSpecs: view.lineSpecs,
    persons,
    holdingKeys,
  });
  return lineKeys.length > 0 ? { ok: false, lineKeys } : { ok: true };
}
