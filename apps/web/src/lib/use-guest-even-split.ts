'use client';

/**
 * Sole guest-phone even-split roster (people ± and names).
 * Amounts via {@link computeSplitResults} — same as staff even path.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeSplitResults } from '@/lib/bill-split-draft';
import {
  defaultSplitPersonNames,
  ensureSplitPersonNames,
  resolveContinuationSplitShape,
  splitDraftPersonCount,
} from '@/lib/checkout-split-continuation';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';
import type { BillSplit, SplitPerson, SplitResult } from '@/types';

export type GuestEvenPersonSlot = { id: string; name: string };

function slotsFromNames(
  names: readonly string[],
  prev?: readonly GuestEvenPersonSlot[],
): GuestEvenPersonSlot[] {
  return names.map((name, idx) => ({
    id: prev?.[idx]?.id ?? `p${idx + 1}`,
    name,
  }));
}

export function useGuestEvenSplit(params: {
  existingSplit: BillSplit | null;
  total: number;
  guestName: (n: number) => string;
  collectedPayments: SessionCollectedPayment[];
  lang: UILanguage;
  locked: boolean;
}) {
  const { existingSplit, total, guestName, collectedPayments, locked } = params;

  const [personCount, setPersonCount] = useState(() => {
    const shape = resolveContinuationSplitShape(existingSplit, guestName);
    return splitDraftPersonCount(shape?.personCount);
  });
  const [splitPeople, setSplitPeople] = useState<GuestEvenPersonSlot[]>(() => {
    const shape = resolveContinuationSplitShape(existingSplit, guestName);
    const names = shape?.personNames ?? defaultSplitPersonNames(guestName);
    return slotsFromNames(names);
  });
  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');

  useEffect(() => {
    if (existingSplit?.split_mode !== 'even') return;
    const shape = resolveContinuationSplitShape(existingSplit, guestName);
    if (!shape) return;
    setPersonCount(splitDraftPersonCount(shape.personCount));
    setSplitPeople(slotsFromNames(shape.personNames));
  }, [existingSplit, guestName]);

  useEffect(() => {
    setSplitPeople((prev) => {
      const names = ensureSplitPersonNames(
        prev.map((p) => p.name),
        personCount,
        guestName,
      );
      return slotsFromNames(names, prev);
    });
  }, [personCount, guestName]);

  const results: SplitResult[] = useMemo(
    () =>
      computeSplitResults({
        splitMode: 'even',
        total,
        orderLines: [],
        lineSpecs: [],
        personCount,
        splitPeople,
        byItemDraftRows: {},
        parsedByItemAllocations: {},
        lang: params.lang,
      }),
    [total, personCount, splitPeople, params.lang],
  );

  const splitDisplayRows = useMemo(
    () => buildCustomerSplitDisplayRows(results, collectedPayments, 0, total),
    [results, collectedPayments, total],
  );

  const incrementPersonCount = useCallback(() => {
    if (locked) return;
    setPersonCount((n) => splitDraftPersonCount(n + 1));
  }, [locked]);

  const decrementPersonCount = useCallback(() => {
    if (locked) return;
    setPersonCount((n) => splitDraftPersonCount(n - 1));
  }, [locked]);

  const startInlineRename = useCallback(
    (index: number) => {
      if (locked) return;
      const current = splitPeople[index];
      if (!current) return;
      setEditingSplitNameIndex(index);
      setEditingSplitNameValue(current.name);
    },
    [locked, splitPeople],
  );

  const commitInlineRename = useCallback(
    (index: number) => {
      const normalized = editingSplitNameValue.trim() || guestName(index + 1);
      setSplitPeople((prev) =>
        prev.map((person, idx) => (idx === index ? { ...person, name: normalized } : person)),
      );
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    [editingSplitNameValue, guestName],
  );

  const buildPayload = useCallback((): { persons: SplitPerson[]; result: SplitResult[] } => {
    const persons = results.map((row) => ({ name: row.name }));
    return { persons, result: results };
  }, [results]);

  return {
    personCount,
    splitPeople,
    results,
    splitDisplayRows,
    editingSplitNameIndex,
    editingSplitNameValue,
    setEditingSplitNameValue,
    incrementPersonCount,
    decrementPersonCount,
    startInlineRename,
    commitInlineRename,
    cancelInlineRename: () => {
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    buildPayload,
  };
}
