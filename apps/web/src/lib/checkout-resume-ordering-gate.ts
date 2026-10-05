/**
 * Sole staff resume-ordering prepare gate:
 * 1) empty unpaid by-item tickets are dropped (flush/prune) before this check
 * 2) unpaid tickets that still remain must not use default serial names
 * Paid / locked tickets with default names are allowed through.
 */
import {
  pruneUnpaidEmptyByItemTickets,
} from '@/lib/checkout-by-item-collect';
import { allocationLockedTicketKeys } from '@/lib/checkout-split-continuation';
import {
  resumeOrderingConfirmVariant,
  type SessionCollectedPayment,
} from '@/lib/checkout-session-payments';
import { isWholeTablePayerName } from '@/lib/split-person-label';
import { splitResultTicketKey } from '@/lib/split-party-id';
import { isDefaultGuestRailName } from '@/lib/staff-by-item-people';
import type { BillSplit, SplitPerson, SplitResult } from '@/types';

export type CheckoutResumeOrderingNameGate =
  | { ok: true }
  | { ok: false; code: 'default_guest_names'; names: string[] };

/**
 * Sole name gate for resume when the split snapshot will be preserved for the phone.
 * Call after empty unpaid by-item tickets were pruned — then every remaining unpaid
 * result row is checked (no second shares lookup that can miss party_id mismatches).
 */
export function resolveCheckoutResumeOrderingNameGate(params: {
  willPreserveSplit: boolean;
  splitMode: string | null | undefined;
  persons: readonly SplitPerson[];
  result: readonly SplitResult[];
}): CheckoutResumeOrderingNameGate {
  if (!params.willPreserveSplit) return { ok: true };

  const names: string[] = [];
  const seen = new Set<string>();

  for (const row of params.result) {
    if (row.paid) continue;
    if (isWholeTablePayerName(row.name)) continue;
    const name = row.name?.trim() ?? '';
    if (!name) continue;
    const key = splitResultTicketKey(row) || `n:${name}`;
    if (!isDefaultGuestRailName(name) || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  if (names.length === 0) return { ok: true };
  return { ok: false, code: 'default_guest_names', names };
}

export type CheckoutResumePrepareResult =
  | { ok: true; persons: SplitPerson[]; result: SplitResult[] }
  | { ok: false; code: 'flush_failed' | 'default_guest_names'; names?: string[] };

type FlushDraft = () => Promise<{
  persons: SplitPerson[];
  result: SplitResult[];
} | null>;

type PersistPruned = (params: {
  persons: SplitPerson[];
  result: SplitResult[];
}) => Promise<{ persons: SplitPerson[]; result: SplitResult[] } | null>;

/**
 * Sole staff resume prepare: flush/prune empty unpaid by-item tickets first,
 * then block default serial names on remaining unpaid tickets worth preserving.
 */
export async function prepareStaffCheckoutResumeOrdering(params: {
  request: BillSplit;
  collectedPayments: readonly SessionCollectedPayment[];
  /** Editor draft flush (by_item merge or even persist). */
  flushDraft: FlushDraft | null;
  /** Persist pruned by-item ledger when no editor flush is registered. */
  persistPrunedByItem: PersistPruned | null;
}): Promise<CheckoutResumePrepareResult> {
  const { request, collectedPayments } = params;
  const variant = resumeOrderingConfirmVariant(request, [...collectedPayments]);
  const willPreserveSplit = variant !== 'cancel_no_collections';
  const lockedTicketKeys = allocationLockedTicketKeys(request, [
    ...collectedPayments,
  ]);

  let persons = [...(request.persons ?? [])];
  let result = [...((request.result ?? []) as SplitResult[])];

  // When the editor can flush, rename happens in that draft — gate after flush.
  // Settle/path_chooser (no flush): gate on pruned server roster before any write.
  if (willPreserveSplit && !params.flushDraft) {
    const pre =
      request.split_mode === 'by_item'
        ? pruneUnpaidEmptyByItemTickets({
            persons,
            result,
            lockedTicketKeys,
          })
        : { persons, result };
    const preGate = resolveCheckoutResumeOrderingNameGate({
      willPreserveSplit,
      splitMode: request.split_mode,
      persons: pre.persons,
      result: pre.result,
    });
    if (!preGate.ok) {
      return { ok: false, code: preGate.code, names: preGate.names };
    }
  }

  if (params.flushDraft) {
    const flushed = await params.flushDraft();
    if (!flushed) return { ok: false, code: 'flush_failed' };
    persons = flushed.persons;
    result = flushed.result;
  } else if (willPreserveSplit && request.split_mode === 'by_item') {
    const pruned = pruneUnpaidEmptyByItemTickets({
      persons,
      result,
      lockedTicketKeys,
    });
    if (pruned.changed) {
      if (!params.persistPrunedByItem) {
        return { ok: false, code: 'flush_failed' };
      }
      const persisted = await params.persistPrunedByItem({
        persons: pruned.persons,
        result: pruned.result,
      });
      if (!persisted) return { ok: false, code: 'flush_failed' };
      persons = persisted.persons;
      result = persisted.result;
    } else {
      persons = pruned.persons;
      result = pruned.result;
    }
  }

  const gate = resolveCheckoutResumeOrderingNameGate({
    willPreserveSplit,
    splitMode: request.split_mode,
    persons,
    result,
  });
  if (!gate.ok) {
    return { ok: false, code: gate.code, names: gate.names };
  }

  return { ok: true, persons, result };
}
