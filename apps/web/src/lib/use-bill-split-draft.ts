'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  afterRemoveCustomPerson,
  appendCustomPersonWithRemainder,
  applyCustomAmountEdit,
  mintNextCustomGuestName,
  seedCustomSoloFullAmount,
} from '@/lib/bill-split-custom-amounts';
import {
  shouldCommitOnSoftKeyboardDismiss,
  softKeyboardOpen,
} from '@/lib/soft-keyboard-viewport';
import { validateSplitDraft } from '@/lib/bill-split-draft';
import type { BillSplitDraftInput } from '@/lib/bill-split-draft';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  withDefaultByItemLineRows,
} from '@/lib/bill-split-by-item';
import {
  billSplitDraftAuthorityKey,
  billSplitHasServerItemShares,
  billSplitLocalDraftOwnerKey,
  clearBillSplitLocalDraft,
  loadBillSplitLocalDraft,
  mayPersistBillSplitLocalDraft,
  resolveBillSplitDraftHydrateAction,
  resolveByItemLocalDraftApplyAction,
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
  total: number,
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
  const rows = customAmountsFromNames(names);
  // Fresh custom (no continuation roster): sole payer starts at full bill.
  if (!shape && rows.length === 1) {
    return seedCustomSoloFullAmount(rows, total);
  }
  return rows;
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
  /** Bill-level discount % — settlement display obligation is fold-discounted. */
  discountRate?: number;
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
    discountRate: discountRateParam,
  } = params;

  const discountRate =
    discountRateParam ??
    (typeof existingSplit?.discount_rate === 'number' ? existingSplit.discount_rate : 0);

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
    initialCustomAmounts(splitSeed, guestName, total),
  );
  const [storageReady, setStorageReady] = useState(false);

  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');
  const [editingCustomAmountIndex, setEditingCustomAmountIndex] = useState<number | null>(null);
  const [editingCustomAmountValue, setEditingCustomAmountValue] = useState('');
  /** Latest amount-edit draft for keyboard-dismiss commit (iOS often skips blur). */
  const editingCustomAmountRef = useRef<{ index: number | null; value: string }>({
    index: null,
    value: '',
  });
  editingCustomAmountRef.current = {
    index: editingCustomAmountIndex,
    value: editingCustomAmountValue,
  };

  /** Which session's local draft was applied into memory — sole gate for persist. */
  const hydratedOwnerKeyRef = useRef<string | null>(null);
  /** Sole applied server-authority fingerprint — change forces reseed (resume continuation). */
  const appliedAuthorityKeyRef = useRef<string | null>(null);
  const loadedLocalDraftRef = useRef<BillSplitLocalDraft | null | undefined>(undefined);
  const byItemLocalAppliedRef = useRef(false);

  const applyServerSeedToMemory = useCallback(() => {
    const seed = continuationSplit ?? existingSplit;
    const mode = resolvePersistedSplitModeForDraft(existingSplit);
    setSplitMode(mode);
    if (existingSplit?.split_mode === 'custom') {
      setPersonCount(initialCustomPersonCount(seed, guestName));
    } else if (existingSplit?.split_mode === 'even') {
      setPersonCount(initialEvenPersonCount(seed, guestName));
    } else {
      setPersonCount(splitDraftPersonCount('even'));
    }
    setSplitPeople(initialSplitPeople(seed, guestName));
    setCustomAmounts(initialCustomAmounts(seed, guestName, total));
    setEditingSplitNameIndex(null);
    setEditingSplitNameValue('');
    setEditingCustomAmountIndex(null);
    setEditingCustomAmountValue('');
  }, [continuationSplit, existingSplit, guestName, total]);

  const applyLocalDraftToMemory = useCallback(
    (draft: BillSplitLocalDraft) => {
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
        } else {
          setSplitPeople(initialSplitPeople(null, guestName));
        }
        if (draft.customAmounts.length > 0) {
          setCustomAmounts(draft.customAmounts);
        } else {
          setCustomAmounts(initialCustomAmounts(null, guestName, total));
        }
      }
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
      setEditingCustomAmountIndex(null);
      setEditingCustomAmountValue('');
    },
    [guestName, total],
  );

  useLayoutEffect(() => {
    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      submitted,
      collectedPaymentCount: collectedPayments.length,
    });
    const authorityKey = billSplitDraftAuthorityKey({
      existingSplit,
      submitted,
      collectedPaymentCount: collectedPayments.length,
    });

    if (sessionId) {
      const ownerKey = billSplitLocalDraftOwnerKey(restaurantId, sessionId);
      if (hydratedOwnerKeyRef.current !== ownerKey) {
        // New open-session: never keep the previous session's roster / authority.
        hydratedOwnerKeyRef.current = ownerKey;
        appliedAuthorityKeyRef.current = null;
        loadedLocalDraftRef.current = undefined;
        byItemLocalAppliedRef.current = false;
      }
    }

    const action = resolveBillSplitDraftHydrateAction({
      sessionId,
      appliedAuthorityKey: appliedAuthorityKeyRef.current,
      authorityKey,
      canRestore,
    });

    if (action === 'reset_no_session') {
      hydratedOwnerKeyRef.current = null;
      appliedAuthorityKeyRef.current = null;
      loadedLocalDraftRef.current = null;
      byItemLocalAppliedRef.current = false;
      setStorageReady(true);
      return;
    }

    if (action === 'noop') {
      if (!canRestore && sessionId) {
        clearBillSplitLocalDraft(restaurantId, sessionId);
      }
      setStorageReady(true);
      return;
    }

    setStorageReady(false);
    byItemLocalAppliedRef.current = false;

    if (action === 'apply_server') {
      if (sessionId) clearBillSplitLocalDraft(restaurantId, sessionId);
      loadedLocalDraftRef.current = null;
      applyServerSeedToMemory();
    } else {
      // apply_local_or_server
      const draft = sessionId ? loadBillSplitLocalDraft(restaurantId, sessionId) : null;
      loadedLocalDraftRef.current = draft;
      if (draft) {
        applyLocalDraftToMemory(draft);
      } else {
        applyServerSeedToMemory();
      }
    }

    appliedAuthorityKeyRef.current = authorityKey;
    setStorageReady(true);
  }, [
    restaurantId,
    sessionId,
    existingSplit,
    submitted,
    collectedPayments.length,
    applyServerSeedToMemory,
    applyLocalDraftToMemory,
  ]);

  const draftOwnerKey = sessionId
    ? billSplitLocalDraftOwnerKey(restaurantId, sessionId)
    : null;

  // Both hooks always called (Rules of Hooks); only the selected editor is active.
  const guestByItem = useGuestByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
    collectedPayments,
    enabled: byItemEditor === 'guest',
    draftOwnerKey,
  });
  const staffByItem = useByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
    collectedPayments,
    enabled: byItemEditor === 'staff',
    draftOwnerKey,
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
    if (!sessionId || !storageReady || byItemLocalAppliedRef.current) return;

    const draft = loadedLocalDraftRef.current;
    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      submitted,
      collectedPaymentCount: collectedPayments.length,
    });
    const action = resolveByItemLocalDraftApplyAction({
      canRestore,
      hasServerItemShares: billSplitHasServerItemShares(existingSplit),
      hasByItemLocalDraft: draft?.splitMode === 'by_item',
    });

    byItemLocalAppliedRef.current = true;
    // leave_reconcile: guest|staff sole hydrate — never setByItemAllocations({}) here.
    if (action !== 'apply_local' || !draft) return;
    setByItemAllocations(withDefaultByItemLineRows(draft.byItemAllocations, lineSpecs));
  }, [
    sessionId,
    storageReady,
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
      !mayPersistBillSplitLocalDraft({
        hydratedOwnerKey: hydratedOwnerKeyRef.current,
        restaurantId,
        sessionId,
      })
    ) {
      return;
    }
    if (
      !shouldRestoreBillSplitLocalDraft({
        existingSplit,
        submitted,
        collectedPaymentCount: collectedPayments.length,
      })
    ) {
      return;
    }
    const ownerKey = billSplitLocalDraftOwnerKey(restaurantId, sessionId);
    const timer = window.setTimeout(() => {
      // Re-check after debounce — session may have changed while the timer was armed.
      if (
        !mayPersistBillSplitLocalDraft({
          hydratedOwnerKey: hydratedOwnerKeyRef.current,
          restaurantId,
          sessionId,
        })
      ) {
        return;
      }
      if (hydratedOwnerKeyRef.current !== ownerKey) return;
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
      byItemDraftRows: byItemAllocations,
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
      byItemAllocations,
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
    () => buildCustomerSplitDisplayRows(results, collectedPayments, discountRate, total),
    [results, collectedPayments, discountRate, total],
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
        setCustomAmounts((prev) => {
          const rows = customAmountsFromNames(names, prev);
          // Fresh custom (not carrying an even roster): sole payer starts at full bill.
          if (!fromEven && rows.length === 1) {
            return seedCustomSoloFullAmount(rows, total);
          }
          return rows;
        });
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
      total,
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
      setCustomAmounts((prev) =>
        applyCustomAmountEdit({
          rows: prev,
          index,
          rawValue,
          total,
        }),
      );
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

  /**
   * Sole draft+commit while typing: update the input string, and when the value is a
   * complete number write through to customAmounts (so iOS keyboard-dismiss without
   * blur still leaves the bill balanced). Trailing "." / empty wait for blur.
   */
  const editCustomAmountDraft = useCallback(
    (index: number, rawValue: string) => {
      setEditingCustomAmountValue(rawValue);
      if (rawValue === '' || rawValue === '.' || rawValue.endsWith('.')) return;
      if (!Number.isFinite(Number(rawValue))) return;
      updateCustomAmount(index, rawValue);
    },
    [updateCustomAmount],
  );

  const commitInlineAmountEdit = useCallback(
    (index: number) => {
      updateCustomAmount(index, editingCustomAmountValue || '0');
      setEditingCustomAmountIndex(null);
      setEditingCustomAmountValue('');
    },
    [updateCustomAmount, editingCustomAmountValue],
  );

  /**
   * iOS “collapse keyboard” often leaves focus on the input (no blur).
   * Close the editor after keyboard was stably open then closed (arm window
   * skips open-animation jitter). Unmount clears focus — do not blur().
   */
  useEffect(() => {
    if (editingCustomAmountIndex == null) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const armedAtMs = Date.now();
    let wasOpen = softKeyboardOpen(window.innerHeight, vv.height);

    const onViewportResize = () => {
      const open = softKeyboardOpen(window.innerHeight, vv.height);
      if (
        !shouldCommitOnSoftKeyboardDismiss(wasOpen, open, {
          armedAtMs,
          nowMs: Date.now(),
        })
      ) {
        wasOpen = open;
        return;
      }
      wasOpen = open;
      const { index, value } = editingCustomAmountRef.current;
      if (index == null) return;
      updateCustomAmount(index, value || '0');
      setEditingCustomAmountIndex(null);
      setEditingCustomAmountValue('');
    };

    vv.addEventListener('resize', onViewportResize);
    return () => vv.removeEventListener('resize', onViewportResize);
  }, [editingCustomAmountIndex, updateCustomAmount]);

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
      const filtered = prev.filter((_, rowIndex) => rowIndex !== index);
      const healed = afterRemoveCustomPerson(filtered, total);
      const names = healed.map((row) => row.name);
      setSplitPeople((peoplePrev) =>
        slotsFromNames(
          names,
          peoplePrev.filter((_, rowIndex) => rowIndex !== index),
        ),
      );
      setPersonCount(splitDraftPersonCount('custom', names.length));
      return healed;
    });
  }, [total]);

  const addCustomPerson = useCallback(() => {
    setCustomAmounts((prev) => {
      const nextCount = splitDraftPersonCount('custom', prev.length + 1);
      if (nextCount <= prev.length) return prev;
      const nextName = mintNextCustomGuestName(prev, guestName);
      const next = appendCustomPersonWithRemainder(prev, total, nextName);
      const names = next.map((row) => row.name);
      setSplitPeople((peoplePrev) => slotsFromNames(names, peoplePrev));
      setPersonCount(nextCount);
      return next;
    });
  }, [guestName, total]);

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
    const committed = commitByItemDraft();
    return {
      ...splitDraftInput,
      byItemDraftRows: committed.committed,
      parsedByItemAllocations: committed.parsed,
    };
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
    editCustomAmountDraft,
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
