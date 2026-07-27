import {
  isWholeTablePayerName,
  WHOLE_TABLE_PAYER_KEY,
} from '@/lib/split-person-label';
import type { BillSplit, SplitMode, SplitPerson, SplitResult } from '@/types';

export type CheckoutRequestPayload = {
  splitMode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  customerNif?: string | null;
};

export function isWholeTableSplitMode(mode: SplitMode | string | null | undefined): boolean {
  return mode === 'whole_table';
}

export function isSplitBillMode(mode: SplitMode | string | null | undefined): boolean {
  return mode === 'even' || mode === 'by_item' || mode === 'custom';
}

/** Authoritative whole-table check: persisted mode first, legacy row shape as fallback. */
export function isWholeTableSplit(split: Pick<BillSplit, 'split_mode' | 'result'>): boolean {
  if (isWholeTableSplitMode(split.split_mode)) return true;
  const rows = split.result ?? [];
  if (rows.length !== 1) return false;
  return isWholeTablePayerName(rows[0]?.name);
}

export function buildWholeTableCheckoutPayload(total: number): CheckoutRequestPayload {
  const name = WHOLE_TABLE_PAYER_KEY;
  return {
    splitMode: 'whole_table',
    persons: [{ name }],
    result: [{ name, amount: total }],
    customerNif: null,
  };
}

/** @deprecated Use buildWholeTableCheckoutPayload */
export const wholeTableCheckoutPayload = buildWholeTableCheckoutPayload;

/** Map UI draft (null = no split button) to persisted checkout intent. */
export function checkoutIntentFromDraftSplitMode(splitMode: SplitMode | null): SplitMode {
  return splitMode ?? 'whole_table';
}

/** Normalize legacy whole-table rows before RPC persistence. */
export function normalizeCheckoutRequestPayload(payload: CheckoutRequestPayload): CheckoutRequestPayload {
  if (payload.splitMode === 'whole_table') {
    const amount = payload.result[0]?.amount ?? 0;
    const name = WHOLE_TABLE_PAYER_KEY;
    return {
      ...payload,
      splitMode: 'whole_table',
      persons: [{ name }],
      result: [{ name, amount }],
    };
  }

  if (payload.splitMode === 'custom' && payload.result.length === 1) {
    const row = payload.result[0];
    if (row && isWholeTablePayerName(row.name)) {
      return buildWholeTableCheckoutPayload(row.amount);
    }
  }

  return payload;
}

/** Bill page draft: whole-table persisted splits show as "no split mode selected". */
export function resolvePersistedSplitModeForDraft(existing: BillSplit | null): SplitMode | null {
  if (!existing) return null;
  if (isWholeTableSplit(existing)) return null;
  return existing.split_mode;
}
