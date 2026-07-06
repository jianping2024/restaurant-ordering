import { calcByItemSplitResults, type ByItemLineAllocation } from '@/lib/bill-split-by-item';
import {
  byItemSplitLineFromOrderLine,
  type BillSplitOrderLine,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item-lines';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { allocateEvenAmounts } from '@/lib/money-allocation';
import type { SplitMode, SplitResult } from '@/types';

export type BillSplitDraftInput = {
  splitMode: SplitMode | null;
  total: number;
  orderLines: BillSplitOrderLine[];
  lineSpecs: ByItemLineSpec[];
  personCount: number;
  splitPeople: Array<{ name: string }>;
  customAmounts: Array<{ name: string; amount: number }>;
  parsedByItemAllocations: ByItemLineAllocation;
  wholeTableLabel: string;
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
    wholeTableLabel,
  } = input;

  if (!splitMode) {
    return [{ name: wholeTableLabel, amount: total }];
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
        byItemSplitLineFromOrderLine(item, (item.name || item.name_pt || '').trim()),
      ),
      allocations: parsedByItemAllocations,
    });
  }

  const manualTotal = customAmounts.slice(0, -1).reduce((sum, row) => sum + row.amount, 0);
  const lastAmount = Math.max(0, total - manualTotal);
  return customAmounts.map((row, index) => ({
    name: row.name,
    amount: index === customAmounts.length - 1 ? lastAmount : row.amount,
  }));
}

export function validateSplitDraft(input: BillSplitDraftInput) {
  const results = computeSplitResults(input);
  const validation = validateBillSplit({
    splitMode: input.splitMode,
    total: input.total,
    results,
    lineSpecs: input.splitMode === 'by_item' ? input.lineSpecs : undefined,
    byItemAllocations: input.splitMode === 'by_item' ? input.parsedByItemAllocations : undefined,
    customAmounts: input.customAmounts,
  });
  return { results, validation };
}
