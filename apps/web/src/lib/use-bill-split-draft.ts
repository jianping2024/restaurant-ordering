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
  resolvePersistedSplitModeForDraft,
} from '@/lib/checkout-split-intent';
import {
  allocationLockedPersonNames,
  buildLockedPersonLineMins,
  commitAllByItemAllocations,
  defaultSplitPersonNames,
  ensureSplitPersonNames,
  isCheckoutSplitLocked,
  resolveContinuationSplitShape,
  splitDraftPersonCount,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { billSplitDisplayResults, buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import { useGuestByItemSplitState } from '@/lib/use-guest-by-item-split-state';
import { useByItemSplitState } from '@/lib/use-by-item-split-state';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { BillSplit, SplitMode, SplitResult } from '@/types';
import type { UILanguage } from '@/lib/i18n';

/** Which by-item *editor* owns in-progress rows (submit wire is shared). */
export type BillSplitByItemEditor = 'guest' | 'staff';

export type SplitPersonSlot = {
  id: string;
  name: string;
};

export type PersonAmount = {
  name: string;
  amount: number;
};

/** Sole mapper: continuation/default names → draft person slots (stable ids). */
function slotsFromNames(names: readonly string[], prev?: readonly SplitPersonSlot[]): SplitPersonSlot[] {
  return names.map((name, idx) => ({
    id: prev?.[idx]?.id ?? `p${idx + 1}`,
    name,
  }));
}

/** Sole mapper: names → custom amount rows (keep prior amounts when name index matches). */
function customAmountsFromNames(
  names: readonly string[],
  prev?: readonly PersonAmount[],
): PersonAmount[] {
  return names.map((name, idx) => ({
    name,
    amount: prev?.[idx]?.amount ?? 0,
  }));
}

function initialEvenPersonCount(existingSplit: BillSplit | null, guestName: (n: number) => string): number {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  return splitDraftPersonCount('even', shape?.personCount);
}

function initialCustomPersonCount(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): number {
  if (existingSplit?.split_mode === 'custom' && existingSplit.result?.length) {
    return splitDraftPersonCount('custom', existingSplit.result.length);
  }
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  return splitDraftPersonCount('custom', shape?.personCount);
}

function initialSplitPeople(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): SplitPersonSlot[] {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  const names = shape?.personNames ?? defaultSplitPersonNames(guestName, 'even');
  return slotsFromNames(names);
}

function initialCustomAmounts(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): PersonAmount[] {
  if (existingSplit?.split_mode === 'custom' && existingSplit.result?.length) {
    const names = ensureSplitPersonNames(
      existingSplit.result.map((row) => row.name),
      splitDraftPersonCount('custom', existingSplit.result.length),
      guestName,
    );
    return names.map((name, idx) => ({
      name,
      amount: existingSplit.result[idx]?.amount ?? 0,
    }));
  }
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  const names =
    shape?.personNames ?? defaultSplitPersonNames(guestName, 'custom');
  return customAmountsFromNames(names);
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
  guestName: (n: number) => string;
  submitted: boolean;
  persistedResult: SplitResult[] | null;
  submitting: boolean;
  lang: UILanguage;
  /** Guest phone vs staff checkout — two editors, one submit wire. */
  byItemEditor: BillSplitByItemEditor;
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
    guestName,
    submitted,
    persistedResult,
    submitting,
    lang,
    byItemEditor,
  } = params;

  const splitSeed = continuationSplit ?? existingSplit;

  const [splitMode, setSplitMode] = useState<SplitMode | null>(() =>
    resolvePersistedSplitModeForDraft(existingSplit),
  );
  const [personCount, setPersonCount] = useState(() => {
    if (existingSplit?.split_mode === 'custom') {
      return initialCustomPersonCount(splitSeed, guestName);
    }
    if (existingSplit?.split_mode === 'even') {
      return initialEvenPersonCount(splitSeed, guestName);
    }
    return splitDraftPersonCount('even');
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
      if (draft.splitMode === 'even') {
        const count = splitDraftPersonCount('even', draft.personCount);
        const names = ensureSplitPersonNames(
          draft.splitPeople.map((person) => person.name),
          count,
          guestName,
        );
        setPersonCount(count);
        setSplitPeople(slotsFromNames(names, draft.splitPeople));
        setCustomAmounts(customAmountsFromNames(names, draft.customAmounts));
      } else if (draft.splitMode === 'custom') {
        const source =
          draft.customAmounts.length > 0 ? draft.customAmounts : draft.splitPeople;
        const count = splitDraftPersonCount(
          'custom',
          source.length > 0 ? source.length : draft.personCount,
        );
        const names = ensureSplitPersonNames(
          source.map((row) => row.name),
          count,
          guestName,
        );
        setPersonCount(count);
        setSplitPeople(slotsFromNames(names, draft.splitPeople));
        setCustomAmounts(customAmountsFromNames(names, draft.customAmounts));
      } else {
        setPersonCount(splitDraftPersonCount('even', draft.personCount));
        if (draft.splitPeople.length > 0) {
          const names = ensureSplitPersonNames(
            draft.splitPeople.map((person) => person.name),
            Math.max(1, draft.splitPeople.length),
            guestName,
          );
          setSplitPeople(slotsFromNames(names, draft.splitPeople));
        }
        if (draft.customAmounts.length > 0) setCustomAmounts(draft.customAmounts);
      }
    }
    setStorageReady(true);
  }, [restaurantId, sessionId, existingSplit, submitted, collectedPayments.length, guestName]);

  // Both hooks always called (Rules of Hooks); only the selected editor is active.
  const guestByItem = useGuestByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
    collectedPayments,
    enabled: byItemEditor === 'guest',
  });
  const staffByItem = useByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
    collectedPayments,
    enabled: byItemEditor === 'staff',
  });
  const {
    byItemAllocations,
    setByItemAllocations,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  } = byItemEditor === 'guest' ? guestByItem : staffByItem;

  useLayoutEffect(() => {
    const draft = loadedLocalDraftRef.current;
    if (!draft || draft.splitMode !== 'by_item' || byItemLocalAppliedRef.current) return;
    // Paid/continuation persons are authoritative — never let a stale local draft wipe them.
    if (
      !shouldRestoreBillSplitLocalDraft({
        existingSplit,
        submitted,
        collectedPaymentCount: collectedPayments.length,
      })
    ) {
      byItemLocalAppliedRef.current = true;
      return;
    }
    if (existingSplit?.persons?.some((person) => (person.item_shares?.length ?? 0) > 0)) {
      byItemLocalAppliedRef.current = true;
      return;
    }
    byItemLocalAppliedRef.current = true;
    setByItemAllocations(withDefaultByItemLineRows(draft.byItemAllocations, lineSpecs));
  }, [
    lineSpecs,
    setByItemAllocations,
    existingSplit,
    submitted,
    collectedPayments.length,
  ]);

  /** Keep even roster length === personCount (sole even people source for compute/submit). */
  useLayoutEffect(() => {
    if (splitMode !== 'even') return;
    const names = ensureSplitPersonNames(
      splitPeople.map((person) => person.name),
      personCount,
      guestName,
    );
    const sameLength = splitPeople.length === names.length;
    const sameNames =
      sameLength && splitPeople.every((person, idx) => person.name === names[idx]);
    if (!sameNames) {
      setSplitPeople((prev) => slotsFromNames(names, prev));
    }
    // Always align customAmounts to the even roster so mode switches do not shrink to the
    // custom default seed (1) while even still shows N people.
    setCustomAmounts((prev) => {
      if (
        prev.length === names.length &&
        prev.every((row, idx) => row.name === names[idx])
      ) {
        return prev;
      }
      return customAmountsFromNames(names, prev);
    });
  }, [splitMode, personCount, splitPeople, guestName]);

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

  const byItemPersonOrder = useMemo(
    () =>
      (continuationSplit?.result ?? existingSplit?.result ?? [])
        .map((row) => row.name)
        .filter((name) => !!name.trim()),
    [continuationSplit?.result, existingSplit?.result],
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
      lang,
      byItemPersonOrder,
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
      lang,
      byItemPersonOrder,
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
      if (mode === 'even') {
        // personCount is the even size; layout effect then aligns roster via ensureSplitPersonNames.
        setPersonCount(
          splitDraftPersonCount('even', Math.max(personCount, splitPeople.length)),
        );
      } else if (mode === 'custom') {
        // From even: keep the even roster. From null/other: prefer custom seed (default 1),
        // do not inflate from the unused even default splitPeople (2).
        const fromEven = splitMode === 'even';
        const source = fromEven
          ? splitPeople
          : customAmounts.length > 0
            ? customAmounts
            : splitPeople;
        const count = splitDraftPersonCount(
          'custom',
          fromEven ? Math.max(personCount, splitPeople.length) : source.length,
        );
        const names = ensureSplitPersonNames(
          source.map((row) => row.name),
          count,
          guestName,
        );
        setPersonCount(count);
        setSplitPeople((prev) => slotsFromNames(names, prev));
        setCustomAmounts((prev) => customAmountsFromNames(names, prev));
      }
    },
    [
      submitting,
      splitLocked,
      splitMode,
      personCount,
      splitPeople,
      customAmounts,
      guestName,
    ],
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
    const n = splitDraftPersonCount('even', personCount - 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      const names = ensureSplitPersonNames(
        prev.map((person) => person.name),
        n,
        guestName,
      );
      const next = slotsFromNames(names, prev);
      setCustomAmounts((customPrev) => customAmountsFromNames(names, customPrev));
      return next;
    });
  }, [personCount, guestName]);

  const incrementPersonCount = useCallback(() => {
    const n = splitDraftPersonCount('even', personCount + 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      const names = ensureSplitPersonNames(
        prev.map((person) => person.name),
        n,
        guestName,
      );
      const next = slotsFromNames(names, prev);
      setCustomAmounts((customPrev) => customAmountsFromNames(names, customPrev));
      return next;
    });
  }, [personCount, guestName]);

  const removeCustomPerson = useCallback((index: number) => {
    setCustomAmounts((prev) => {
      if (prev.length <= 1 || index < 0 || index >= prev.length) return prev;
      const nextAmounts = prev.filter((_, rowIndex) => rowIndex !== index);
      const names = nextAmounts.map((row) => row.name);
      setSplitPeople((peoplePrev) =>
        slotsFromNames(
          names,
          peoplePrev.filter((_, rowIndex) => rowIndex !== index),
        ),
      );
      setPersonCount(splitDraftPersonCount('custom', names.length));
      return nextAmounts;
    });
  }, []);

  const addCustomPerson = useCallback(() => {
    setCustomAmounts((prev) => {
      const nextCount = splitDraftPersonCount('custom', prev.length + 1);
      const names = ensureSplitPersonNames(
        [
          ...prev.map((row) => row.name),
          splitPeople[prev.length]?.name ?? '',
        ],
        nextCount,
        guestName,
      );
      setSplitPeople((peoplePrev) => slotsFromNames(names, peoplePrev));
      setPersonCount(nextCount);
      return customAmountsFromNames(names, prev);
    });
  }, [guestName, splitPeople]);

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
    renameByItemConsumer,
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
    removeCustomPerson,
    setEditingSplitNameIndex,
    setEditingCustomAmountIndex,
  };
}
