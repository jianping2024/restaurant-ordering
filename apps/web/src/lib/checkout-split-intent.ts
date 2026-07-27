import {
  isWholeTablePayerName,
  WHOLE_TABLE_PAYER_KEY,
} from '@/lib/split-person-label';
import type { BillSplit, SplitMode, SplitPerson, SplitResult } from '@/types';

export const SPLIT_MODES = ['whole_table', 'even', 'by_item', 'custom'] as const satisfies readonly SplitMode[];

export type CheckoutRequestPayload = {
  splitMode: SplitMode;
  persons: SplitPerson[];
  result: SplitResult[];
  customerNif?: string | null;
};

export function parseSplitMode(raw: unknown): SplitMode | null {
  if (typeof raw !== 'string') return null;
  return (SPLIT_MODES as readonly string[]).includes(raw) ? (raw as SplitMode) : null;
}

export function isWholeTableSplitMode(mode: SplitMode | string | null | undefined): boolean {
  return mode === 'whole_table';
}

/** Split modes that lock payer row count after partial collection. */
export function isShapeLockSplitMode(mode: SplitMode): boolean {
  return mode === 'whole_table' || mode === 'even' || mode === 'custom';
}

export function wholeTableSplitResult(total: number): SplitResult[] {
  return [{ name: WHOLE_TABLE_PAYER_KEY, amount: total }];
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
    result: wholeTableSplitResult(total),
    customerNif: null,
  };
}

/** Map UI draft (null = no split button) to persisted checkout intent. */
export function checkoutIntentFromDraftSplitMode(splitMode: SplitMode | null): SplitMode {
  return splitMode ?? 'whole_table';
}

/** Normalize legacy whole-table rows before RPC persistence. */
export function normalizeCheckoutRequestPayload(payload: CheckoutRequestPayload): CheckoutRequestPayload {
  if (payload.splitMode === 'whole_table') {
    const amount = payload.result[0]?.amount ?? 0;
    return {
      ...payload,
      splitMode: 'whole_table',
      persons: [{ name: WHOLE_TABLE_PAYER_KEY }],
      result: wholeTableSplitResult(amount),
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
