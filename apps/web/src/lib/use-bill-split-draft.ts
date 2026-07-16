'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { validateSplitDraft } from '@/lib/bill-split-draft';
import type { BillSplitDraftInput } from '@/lib/bill-split-draft';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  withDefaultByItemLineRows,
} from '@/lib/bill-split-by-item';
import {
  clearBillSplitLocalDraft,
  loadBillSplitLocalDraft,
  saveBillSplitLocalDraft,
  shouldRestoreBillSplitLocalDraft,
  type BillSplitLocalDraft,
} from '@/lib/bill-split-local-draft';
import {
  allocationLockedPersonNames,
  buildLockedPersonLineMins,
  commitAllByItemAllocations,
  isCheckoutSplitLocked,
  resolveContinuationSplitShape,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { billSplitDisplayResults, buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import { useByItemSplitState } from '@/lib/use-by-item-split-state';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { BillSplit, SplitMode, SplitResult } from '@/types';

export type SplitPersonSlot = {
  id: string;
  name: string;
};

export type PersonAmount = {
  name: string;
  amount: number;
};

export function resolveInitialSplitMode(existingSplit: BillSplit | null): SplitMode | null {
  if (!existingSplit) return null;
  if (existingSplit.split_mode === 'custom' && existingSplit.result?.length === 1) return null;
  return existingSplit.split_mode;
}

function initialEvenPersonCount(existingSplit: BillSplit | null, guestName: (n: number) => string): number {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  if (shape) return shape.personCount;
  return 2;
}

function initialSplitPeople(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): SplitPersonSlot[] {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  if (shape) {
    return shape.personNames.map((name, idx) => ({ id: `p${idx + 1}`, name }));
  }
  return [
    { id: 'p1', name: guestName(1) },
    { id: 'p2', name: guestName(2) },
  ];
}

function initialCustomAmounts(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): PersonAmount[] {
  if (existingSplit?.split_mode === 'custom' && existingSplit.result?.length) {
    return existingSplit.result.map((row) => ({ name: row.name, amount: row.amount }));
  }
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  if (shape) {
    return shape.personNames.map((name) => ({ name, amount: 0 }));
  }
  return [
    { name: guestName(1), amount: 0 },
    { name: guestName(2), amount: 0 },
  ];
}

export function useBillSplitDraft(params: {
  restaurantId: string;
  sessionId: string | null;
  existingSplit: BillSplit | null;
  continuationSplit: BillSplit | null;
  collectedPayments: SessionCollectedPayment[];
  total: number;
  orderLines: BillSplitOrderLine[];
  lineSpecs: ByItemLineSpec[];
  wholeTableLabel: string;
  guestName: (n: number) => string;
  submitted: boolean;
  persistedResult: SplitResult[] | null;
  submitting: boolean;
}) {
  const {
    restaurantId,
    sessionId,
    existingSplit,
    continuationSplit,
    collectedPayments,
    total,
    orderLines,
    lineSpecs,
    wholeTableLabel,
    guestName,
    submitted,
    persistedResult,
    submitting,
  } = params;

  const splitSeed = continuationSplit ?? existingSplit;

  const [splitMode, setSplitMode] = useState<SplitMode | null>(() => resolveInitialSplitMode(existingSplit));
  const [personCount, setPersonCount] = useState(() => {
    if (existingSplit?.split_mode === 'even') {
      return initialEvenPersonCount(splitSeed, guestName);
    }
    return 2;
  });
  const [splitPeople, setSplitPeople] = useState<SplitPersonSlot[]>(() =>
    initialSplitPeople(splitSeed, guestName),
  );
  const [customAmounts, setCustomAmounts] = useState<PersonAmount[]>(() =>
    initialCustomAmounts(splitSeed, guestName),
  );
  const [storageReady, setStorageReady] = useState(false);

  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');
  const [editingCustomAmountIndex, setEditingCustomAmountIndex] = useState<number | null>(null);
  const [editingCustomAmountValue, setEditingCustomAmountValue] = useState('');

  const loadedLocalDraftRef = useRef<BillSplitLocalDraft | null | undefined>(undefined);
  const byItemLocalAppliedRef = useRef(false);

  useLayoutEffect(() => {
    if (loadedLocalDraftRef.current !== undefined) {
      setStorageReady(true);
      return;
    }
    if (!sessionId) {
      loadedLocalDraftRef.current = null;
      setStorageReady(true);
      return;
    }

    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      submitted,
      collectedPaymentCount: collectedPayments.length,
    });
    if (!canRestore) {
      clearBillSplitLocalDraft(restaurantId, sessionId);
      loadedLocalDraftRef.current = null;
      setStorageReady(true);
      return;
    }

    const draft = loadBillSplitLocalDraft(restaurantId, sessionId);
    loadedLocalDraftRef.current = draft;
    if (draft) {
      setSplitMode(draft.splitMode);
      setPersonCount(draft.personCount);
      if (draft.splitPeople.length > 0) setSplitPeople(draft.splitPeople);
      if (draft.customAmounts.length > 0) setCustomAmounts(draft.customAmounts);
    }
    setStorageReady(true);
  }, [restaurantId, sessionId, existingSplit, submitted, collectedPayments.length]);

  const {
    byItemAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  } = useByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
  });

  useLayoutEffect(() => {
    const draft = loadedLocalDraftRef.current;
    if (!draft || draft.splitMode !== 'by_item' || byItemLocalAppliedRef.current) return;
    byItemLocalAppliedRef.current = true;
    setByItemAllocations(withDefaultByItemLineRows(draft.byItemAllocations, lineSpecs));
  }, [lineSpecs, setByItemAllocations]);

  useEffect(() => {
    if (!sessionId || !submitted) return;
    clearBillSplitLocalDraft(restaurantId, sessionId);
  }, [restaurantId, sessionId, submitted]);

  useEffect(() => {
    if (!storageReady || !sessionId || submitted) return;
    if (
      !shouldRestoreBillSplitLocalDraft({
        existingSplit,
        submitted,
        collectedPaymentCount: collectedPayments.length,
      })
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      saveBillSplitLocalDraft(restaurantId, sessionId, {
        splitMode,
        personCount,
        splitPeople,
        customAmounts,
        byItemAllocations,
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    storageReady,
    restaurantId,
    sessionId,
    submitted,
    existingSplit,
    collectedPayments.length,
    splitMode,
    personCount,
    splitPeople,
    customAmounts,
    byItemAllocations,
  ]);

  const collectedLedgerActive = collectedPayments.length > 0;
  /** Server snapshot at page load — paid floors must not follow client submit state. */
  const lockAnchorSplit = existingSplit;
  const splitLocked = useMemo(
    () => isCheckoutSplitLocked(lockAnchorSplit, collectedLedgerActive),
    [lockAnchorSplit, collectedLedgerActive],
  );
  const lockedPersonLineMins = useMemo(
    () =>
      splitLocked
        ? buildLockedPersonLineMins(lockAnchorSplit, collectedLedgerActive, collectedPayments)
        : { menu: new Map(), buffet: new Map() },
    [splitLocked, lockAnchorSplit, collectedLedgerActive, collectedPayments],
  );
  const lockedPersonNames = useMemo(
    () => allocationLockedPersonNames(lockAnchorSplit, collectedPayments),
    [lockAnchorSplit, collectedPayments],
  );

  const splitDraftInput = useMemo<BillSplitDraftInput>(
    () => ({
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      customAmounts,
      parsedByItemAllocations,
      wholeTableLabel,
    }),
    [
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      customAmounts,
      parsedByItemAllocations,
      wholeTableLabel,
    ],
  );

  const { results: computedResults, validation: splitValidation } = useMemo(
    () => validateSplitDraft(splitDraftInput),
    [splitDraftInput],
  );

  const results = billSplitDisplayResults({
    checkoutSubmitted: submitted,
    persistedResult,
    draftResults: computedResults,
  });

  const splitDisplayRows = useMemo(
    () => buildCustomerSplitDisplayRows(results, collectedPayments),
    [results, collectedPayments],
  );

  const syncNameAcrossModes = useCallback((index: number, name: string) => {
    setSplitPeople((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
    setCustomAmounts((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
  }, []);

  const handleSplitModeClick = useCallback(
    (mode: SplitMode) => {
      if (submitting || splitLocked) return;
      if (splitMode === mode) {
        setSplitMode(null);
        return;
      }
      setSplitMode(mode);
    },
    [submitting, splitLocked, splitMode],
  );

  const startInlineRename = useCallback(
    (index: number) => {
      const current = splitPeople[index];
      if (!current) return;
      if (splitLocked && lockedPersonNames.has(current.name.trim().toLowerCase())) return;
      setEditingSplitNameIndex(index);
      setEditingSplitNameValue(current.name);
    },
    [splitPeople, splitLocked, lockedPersonNames],
  );

  const commitInlineRename = useCallback(
    (index: number) => {
      const normalized = editingSplitNameValue.trim();
      if (splitMode === 'by_item') {
        const oldName = results[index]?.name;
        if (oldName && normalized) {
          if (splitLocked && lockedPersonNames.has(oldName.trim().toLowerCase())) {
            setEditingSplitNameIndex(null);
            setEditingSplitNameValue('');
            return;
          }
          renameByItemConsumer(oldName, normalized);
        }
      } else {
        syncNameAcrossModes(index, normalized || guestName(index + 1));
      }
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    [
      editingSplitNameValue,
      splitMode,
      results,
      splitLocked,
      lockedPersonNames,
      renameByItemConsumer,
      syncNameAcrossModes,
      guestName,
    ],
  );

  const updateCustomAmount = useCallback(
    (index: number, rawValue: string) => {
      const parsed = Number(rawValue);
      const safeValue = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
      setCustomAmounts((prev) => {
        const othersTotal = prev.reduce((sum, person, idx) => (idx === index ? sum : sum + person.amount), 0);
        const maxAllowed = Math.max(0, total - othersTotal);
        const nextValue = Math.min(safeValue, maxAllowed);
        return prev.map((person, idx) => (idx === index ? { ...person, amount: nextValue } : person));
      });
    },
    [total],
  );

  const startInlineAmountEdit = useCallback(
    (index: number) => {
      setEditingCustomAmountIndex(index);
      setEditingCustomAmountValue(String(customAmounts[index]?.amount ?? 0));
    },
    [customAmounts],
  );

  const commitInlineAmountEdit = useCallback(
    (index: number) => {
      updateCustomAmount(index, editingCustomAmountValue || '0');
      setEditingCustomAmountIndex(null);
      setEditingCustomAmountValue('');
    },
    [updateCustomAmount, editingCustomAmountValue],
  );

  const decrementPersonCount = useCallback(() => {
    const n = Math.max(2, personCount - 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      const next = prev.slice(0, n);
      setCustomAmounts((customPrev) => {
        const cut = customPrev.slice(0, n);
        return cut.map((row, idx) => ({ ...row, name: next[idx]?.name || row.name }));
      });
      return next;
    });
  }, [personCount]);

  const incrementPersonCount = useCallback(() => {
    const n = Math.min(20, personCount + 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      if (prev.length >= n) return prev.slice(0, n);
      const next = [...prev];
      for (let i = prev.length; i < n; i += 1) {
        next.push({ id: `p${i + 1}`, name: guestName(i + 1) });
      }
      setCustomAmounts((customPrev) => {
        const merged = [...customPrev];
        while (merged.length < n) {
          const idx = merged.length;
          merged.push({ name: next[idx].name, amount: 0 });
        }
        return merged.slice(0, n).map((row, idx) => ({ ...row, name: next[idx].name }));
      });
      return next;
    });
  }, [personCount, guestName]);

  const addCustomPerson = useCallback(() => {
    setCustomAmounts((prev) => {
      const nextIndex = prev.length;
      const fallback = guestName(nextIndex + 1);
      const name = splitPeople[nextIndex]?.name || fallback;
      return [...prev, { name, amount: 0 }];
    });
    setSplitPeople((prev) => {
      if (prev.length > customAmounts.length) return prev;
      const nextIndex = prev.length;
      return [...prev, { id: `p${nextIndex + 1}`, name: guestName(nextIndex + 1) }];
    });
  }, [guestName, splitPeople, customAmounts.length]);

  const commitByItemDraft = useCallback(() => {
    const committed = commitAllByItemAllocations({
      allocations: byItemAllocations,
      lineSpecs,
      locks: lockedPersonLineMins,
    });
    const parsed = buildByItemAllocationsFromRows(lineSpecs, committed);
    return { committed, parsed };
  }, [byItemAllocations, lineSpecs, lockedPersonLineMins]);

  const buildPersonsForSubmitCommitted = useCallback(() => {
    if (splitMode !== 'by_item') return buildPersonsForSubmit();
    return buildSplitPersonsFromAllocations(commitByItemDraft().parsed);
  }, [splitMode, buildPersonsForSubmit, commitByItemDraft]);

  const resolveSplitDraftInputForSubmit = useCallback((): BillSplitDraftInput => {
    if (splitMode !== 'by_item') return splitDraftInput;
    return { ...splitDraftInput, parsedByItemAllocations: commitByItemDraft().parsed };
  }, [splitMode, splitDraftInput, commitByItemDraft]);

  return {
    splitMode,
    personCount,
    splitPeople,
    customAmounts,
    splitLocked,
    lockedPersonLineMins,
    lockedPersonNames,
    splitDraftInput,
    splitValidation,
    results,
    splitDisplayRows,
    byItemAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    byItemProgress,
    buildPersonsForSubmit: buildPersonsForSubmitCommitted,
    resolveSplitDraftInputForSubmit,
    handleSplitModeClick,
    editingSplitNameIndex,
    editingSplitNameValue,
    setEditingSplitNameValue,
    editingCustomAmountIndex,
    editingCustomAmountValue,
    setEditingCustomAmountValue,
    startInlineRename,
    commitInlineRename,
    startInlineAmountEdit,
    commitInlineAmountEdit,
    decrementPersonCount,
    incrementPersonCount,
    addCustomPerson,
    setEditingSplitNameIndex,
    setEditingCustomAmountIndex,
  };
}
