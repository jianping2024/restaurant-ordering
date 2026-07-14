import type { BillSplitDraftInput } from '@/lib/bill-split-draft';
import { validateSplitDraft } from '@/lib/bill-split-draft';
import { deriveBillView } from '@/lib/customer-bill-sync';
import type { SplitMode, SplitPerson, SplitResult } from '@/types';
import type { BillSplit, Order } from '@/types';

/** Reuse a recent background bill sync instead of forcing another round-trip. */
export const BILL_SYNC_FRESH_MS = 15_000;

export function shouldSkipPreSubmitOrderSync(
  lastSyncedAt: number | null,
  now = Date.now(),
): boolean {
  if (lastSyncedAt == null) return false;
  return now - lastSyncedAt <= BILL_SYNC_FRESH_MS;
}

export function buildSubmitPersons(params: {
  splitMode: SplitMode | null;
  submitResults: SplitResult[];
  splitPeople: ReadonlyArray<{ name: string }>;
  buildPersonsForSubmit: () => SplitPerson[];
}): SplitPerson[] {
  const { splitMode, submitResults, splitPeople, buildPersonsForSubmit } = params;
  if (splitMode === 'by_item') return buildPersonsForSubmit();
  return splitPeople.slice(0, submitResults.length).map((person, idx) => ({
    name: submitResults[idx]?.name ?? person.name,
  }));
}

export function validateSubmitSplitDraft(
  splitDraftInput: BillSplitDraftInput,
  orders: Order[],
): {
  ok: true;
  submitResults: SplitResult[];
} | {
  ok: false;
  issue: 'unassigned_items' | 'incomplete_qty' | 'amount_mismatch';
} {
  const freshView = deriveBillView(orders);
  const { results: submitResults, validation } = validateSplitDraft({
    ...splitDraftInput,
    total: freshView.total,
    orderLines: freshView.orderLines,
    lineSpecs: freshView.lineSpecs,
  });
  if (!validation.ok) {
    return { ok: false, issue: validation.issue };
  }
  return { ok: true, submitResults };
}

export function buildOptimisticRequestedBillSplit(input: {
  restaurantId: string;
  sessionId: string;
  tableId: string;
  displayName: string;
  billSplitId: string;
  splitMode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  totalAmount: number;
  customerNif: string | null;
  orderIds: string[];
}): BillSplit {
  return {
    id: input.billSplitId,
    restaurant_id: input.restaurantId,
    session_id: input.sessionId,
    table_id: input.tableId,
    display_name: input.displayName,
    order_ids: input.orderIds,
    split_mode: input.splitMode,
    persons: input.persons,
    result: input.result,
    total_amount: input.totalAmount,
    status: 'requested',
    created_at: new Date().toISOString(),
    customer_nif: input.customerNif,
  };
}

/** Insert or replace a queue row, keeping ascending created_at order. */
export function upsertCheckoutRequestInQueue(
  prev: readonly BillSplit[],
  row: BillSplit,
): BillSplit[] {
  const without = prev.filter((entry) => entry.id !== row.id);
  return [...without, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const CHECKOUT_REDIRECT_TIMEOUT_MS = 8_000;

export const DASHBOARD_CHECKOUT_PATH_PREFIX = '/dashboard/checkout';
