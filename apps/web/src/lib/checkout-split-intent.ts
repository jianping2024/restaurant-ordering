import {
  isWholeTablePayerName,
  WHOLE_TABLE_PAYER_KEY,
} from '@/lib/split-person-label';
import { mintSplitPartyId, parseOptionalPartyId } from '@/lib/split-party-id';
import type { BillSplit, SplitMode, SplitPerson, SplitResult } from '@/types';

export const SPLIT_MODES = ['whole_table', 'by_item', 'even'] as const satisfies readonly SplitMode[];

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
  return mode === 'whole_table' || mode === 'even';
}

export function wholeTableSplitResult(total: number, partyId?: string): SplitResult[] {
  const party_id = parseOptionalPartyId(partyId) ?? mintSplitPartyId();
  return [{ name: WHOLE_TABLE_PAYER_KEY, amount: total, party_id }];
}

/** Authoritative whole-table check: persisted mode first, legacy row shape as fallback. */
export function isWholeTableSplit(split: Pick<BillSplit, 'split_mode' | 'result'>): boolean {
  if (isWholeTableSplitMode(split.split_mode)) return true;
  const rows = split.result ?? [];
  if (rows.length !== 1) return false;
  return isWholeTablePayerName(rows[0]?.name);
}

export function buildWholeTableCheckoutPayload(
  total: number,
  partyId?: string,
): CheckoutRequestPayload {
  const name = WHOLE_TABLE_PAYER_KEY;
  const party_id = parseOptionalPartyId(partyId) ?? mintSplitPartyId();
  return {
    splitMode: 'whole_table',
    persons: [{ name, party_id }],
    result: wholeTableSplitResult(total, party_id),
    customerNif: null,
  };
}

/** Map UI draft (null = no split button) to persisted checkout intent. */
export function checkoutIntentFromDraftSplitMode(splitMode: SplitMode | null): SplitMode {
  return splitMode ?? 'whole_table';
}

/**
 * Normalize checkout intent shape before RPC.
 * Whole-table obligation amount: pass `authoritativeWholeTableTotal` (server billable)
 * — never trust a client placeholder (e.g. call-checkout `amount: 0`).
 */
export function normalizeCheckoutRequestPayload(
  payload: CheckoutRequestPayload,
  options?: { authoritativeWholeTableTotal?: number },
): CheckoutRequestPayload {
  if (payload.splitMode === 'whole_table') {
    const amount =
      options?.authoritativeWholeTableTotal !== undefined
        ? options.authoritativeWholeTableTotal
        : (payload.result[0]?.amount ?? 0);
    const existingPartyId =
      parseOptionalPartyId(payload.result[0]?.party_id) ??
      parseOptionalPartyId(payload.persons[0]?.party_id);
    return {
      ...buildWholeTableCheckoutPayload(amount, existingPartyId),
      customerNif: payload.customerNif ?? null,
    };
  }

  return payload;
}

/** Bill page draft: whole-table persisted splits show as "no split mode selected". */
export function resolvePersistedSplitModeForDraft(existing: BillSplit | null): SplitMode | null {
  if (!existing) return null;
  if (isWholeTableSplit(existing)) return null;
  return existing.split_mode;
}
