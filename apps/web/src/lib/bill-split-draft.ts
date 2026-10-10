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
import { parseOptionalPartyId, toWireSplitResult } from '@/lib/split-party-id';
import type { SplitMode, SplitResult } from '@/types';

export type BillSplitDraftInput = {
  splitMode: SplitMode | null;
  total: number;
  orderLines: BillSplitOrderLine[];
  lineSpecs: ByItemLineSpec[];
  personCount: number;
  /** Even seats: name + optional stable partyId (required on submit path). */
  splitPeople: Array<{ name: string; partyId?: string }>;
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
    parsedByItemAllocations,
    lang,
    byItemPersonOrder,
    byItemPersonPartyIds,
  } = input;

  // Sole whole-table mint: draft null and persisted `'whole_table'` share one result shape.
  if (!splitMode || splitMode === 'whole_table') {
    return wholeTableSplitResult(total);
  }

  if (splitMode === 'even') {
    const seats = splitPeople.slice(0, personCount);
    const names = seats.map((person) => person.name);
    const amounts = allocateEvenAmounts(total, names);
    return seats.map((person, index) =>
      toWireSplitResult({
        name: person.name,
        amount: amounts[index] ?? 0,
        partyId: parseOptionalPartyId(person.partyId),
      }),
    );
  }

  return calcByItemSplitResults({
    lines: orderLines.map((item) =>
      byItemSplitLineFromOrderLine(item, resolveMenuItemLocalizedName(item, lang)),
    ),
    allocations: parsedByItemAllocations,
    personOrder: byItemPersonOrder,
    personPartyIds: byItemPersonPartyIds,
  }).map((row) => toWireSplitResult(row));
}

export function validateSplitDraft(
  input: BillSplitDraftInput,
  options?: { allowPartialByItem?: boolean },
) {
  const results = computeSplitResults(input);
  if (input.splitMode === 'by_item') {
    const draftValidation = validateByItemDraftRows({
      lineSpecs: input.lineSpecs,
      rowsByKey: input.byItemDraftRows,
      allowPartialByItem: options?.allowPartialByItem,
    });
    if (!draftValidation.ok) return { results, validation: draftValidation };
  }
  const validation = validateBillSplit({
    splitMode: input.splitMode,
    total: input.total,
    results,
    lineSpecs: input.splitMode === 'by_item' ? input.lineSpecs : undefined,
    byItemAllocations: input.splitMode === 'by_item' ? input.parsedByItemAllocations : undefined,
    allowPartialByItem: options?.allowPartialByItem,
  });
  return { results, validation };
}
