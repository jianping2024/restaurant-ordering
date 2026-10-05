import {
  calcByItemSplitResults,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import {
  byItemSplitLineFromOrderLine,
  type BillSplitOrderLine,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item-lines';
import { validateBillSplit, validateByItemDraftRows } from '@/lib/bill-split-validate';
import { wholeTableSplitResult } from '@/lib/checkout-split-intent';
import { allocateEvenAmounts } from '@/lib/money-allocation';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';
import { toWireSplitResult } from '@/lib/split-party-id';
import type { SplitMode, SplitResult } from '@/types';

export type BillSplitDraftInput = {
  splitMode: SplitMode | null;
  total: number;
  orderLines: BillSplitOrderLine[];
  lineSpecs: ByItemLineSpec[];
  personCount: number;
  splitPeople: Array<{ name: string }>;
  customAmounts: Array<{ name: string; amount: number }>;
  byItemDraftRows: Record<string, ByItemConsumerRow[]>;
  parsedByItemAllocations: ByItemLineAllocation;
  lang: UILanguage;
  /** Ledger roster names for by-item result rows / person_index (aligned with party ids). */
  byItemPersonOrder?: readonly string[];
  /** Parallel party ids for {@link byItemPersonOrder} — sole by-item ticket identity. */
  byItemPersonPartyIds?: readonly (string | undefined)[];
};

export function computeSplitResults(input: BillSplitDraftInput): SplitResult[] {
  const {
    splitMode,
    total,
    orderLines,
    personCount,
    splitPeople,
    customAmounts,
    parsedByItemAllocations,
    lang,
    byItemPersonOrder,
    byItemPersonPartyIds,
  } = input;

  if (!splitMode) {
    return wholeTableSplitResult(total);
  }

  if (splitMode === 'even') {
    const names = splitPeople.slice(0, personCount).map((person) => person.name);
    const amounts = allocateEvenAmounts(total, names);
    return names.map((name, index) => ({
      name,
      amount: amounts[index] ?? 0,
    }));
  }

  if (splitMode === 'by_item') {
    return calcByItemSplitResults({
      lines: orderLines.map((item) =>
        byItemSplitLineFromOrderLine(item, resolveMenuItemLocalizedName(item, lang)),
      ),
      allocations: parsedByItemAllocations,
      personOrder: byItemPersonOrder,
      personPartyIds: byItemPersonPartyIds,
    }).map((row) => toWireSplitResult(row));
  }

  // Custom amounts are authoritative (applyCustomAmountEdit / append / afterRemove).
  // Do not rewrite the last row here — that forced solo drafts back to full bill.
  return customAmounts.map((row) => ({
    name: row.name,
    amount: row.amount,
  }));
}

export function validateSplitDraft(
  input: BillSplitDraftInput,
  options?: { allowPartialByItem?: boolean; ignoreUnnamedRows?: boolean },
) {
  const results = computeSplitResults(input);
  if (input.splitMode === 'by_item') {
    const draftValidation = validateByItemDraftRows({
      lineSpecs: input.lineSpecs,
      rowsByKey: input.byItemDraftRows,
      allowPartialByItem: options?.allowPartialByItem,
      ignoreUnnamedRows: options?.ignoreUnnamedRows,
    });
    if (!draftValidation.ok) return { results, validation: draftValidation };
  }
  const validation = validateBillSplit({
    splitMode: input.splitMode,
    total: input.total,
    results,
    lineSpecs: input.splitMode === 'by_item' ? input.lineSpecs : undefined,
    byItemAllocations: input.splitMode === 'by_item' ? input.parsedByItemAllocations : undefined,
    customAmounts: input.customAmounts,
    allowPartialByItem: options?.allowPartialByItem,
  });
  return { results, validation };
}
