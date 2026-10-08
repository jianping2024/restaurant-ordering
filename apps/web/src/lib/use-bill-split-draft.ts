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
  isStaffCheckoutSplitModeFrozen,
  resolveContinuationSplitShape,
  splitDraftPersonCount,
  staffMayChangeCheckoutSplitMode,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import { useByItemSplitState } from '@/lib/use-by-item-split-state';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import type { BillSplit, SplitMode } from '@/types';
import type { UILanguage } from '@/lib/i18n';

export type SplitPersonSlot = {
  id: string;
  name: string;
};

/** Sole mapper: continuation/default names → draft person slots (stable ids). */
function slotsFromNames(names: readonly string[], prev?: readonly SplitPersonSlot[]): SplitPersonSlot[] {
  return names.map((name, idx) => ({
    id: prev?.[idx]?.id ?? `p${idx + 1}`,
    name,
  }));
}

function initialEvenPersonCount(existingSplit: BillSplit | null, guestName: (n: number) => string): number {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  return splitDraftPersonCount(shape?.personCount);
}

function initialSplitPeople(
  existingSplit: BillSplit | null,
  guestName: (n: number) => string,
): SplitPersonSlot[] {
  const shape = resolveContinuationSplitShape(existingSplit, guestName);
  const names = shape?.personNames ?? defaultSplitPersonNames(guestName);
  return slotsFromNames(names);
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
  submitting: boolean;
  lang: UILanguage;
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
    submitting,
    lang,
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
    if (existingSplit?.split_mode === 'even') {
      return initialEvenPersonCount(splitSeed, guestName);
    }
    return splitDraftPersonCount();
  });
  const [splitPeople, setSplitPeople] = useState<SplitPersonSlot[]>(() =>
    initialSplitPeople(splitSeed, guestName),
  );
  const [storageReady, setStorageReady] = useState(false);

  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');
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
    if (existingSplit?.split_mode === 'even') {
      setPersonCount(initialEvenPersonCount(seed, guestName));
    } else {
      setPersonCount(splitDraftPersonCount());
    }
    setSplitPeople(initialSplitPeople(seed, guestName));
    setEditingSplitNameIndex(null);
    setEditingSplitNameValue('');
  }, [continuationSplit, existingSplit, guestName]);

  const applyLocalDraftToMemory = useCallback(
    (draft: BillSplitLocalDraft) => {
      setSplitMode(draft.splitMode);
      if (draft.splitMode === 'even') {
        const count = splitDraftPersonCount(draft.personCount);
        const names = ensureSplitPersonNames(
          draft.splitPeople.map((person) => person.name),
          count,
          guestName,
        );
        setPersonCount(count);
        setSplitPeople(slotsFromNames(names, draft.splitPeople));
      } else {
        setPersonCount(splitDraftPersonCount(draft.personCount));
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
      }
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    [guestName],
  );

  useLayoutEffect(() => {
    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      collectedPaymentCount: collectedPayments.length,
    });
    const authorityKey = billSplitDraftAuthorityKey({
      existingSplit,
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
    collectedPayments.length,
    applyServerSeedToMemory,
    applyLocalDraftToMemory,
  ]);

  const draftOwnerKey = sessionId
    ? billSplitLocalDraftOwnerKey(restaurantId, sessionId)
    : null;

  const {
    byItemAllocations,
    setByItemAllocations,
    parsedByItemAllocations,
    renameByItemConsumer,
    buildPersonsForSubmit,
    recordStaffByItemShareOmit,
    clearStaffByItemShareOmit,
  } = useByItemSplitState({
    splitMode,
    lineSpecs,
    existingSplit: continuationSplit,
    collectedPayments,
    draftOwnerKey,
  });

  useLayoutEffect(() => {
    if (!sessionId || !storageReady || byItemLocalAppliedRef.current) return;

    const draft = loadedLocalDraftRef.current;
    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      collectedPaymentCount: collectedPayments.length,
    });
    const action = resolveByItemLocalDraftApplyAction({
      canRestore,
      hasServerItemShares: billSplitHasServerItemShares(existingSplit),
      hasByItemLocalDraft: draft?.splitMode === 'by_item',
    });

    byItemLocalAppliedRef.current = true;
    // leave_reconcile: staff sole hydrate — never setByItemAllocations({}) here.
    if (action !== 'apply_local' || !draft) return;
    setByItemAllocations(withDefaultByItemLineRows(draft.byItemAllocations, lineSpecs));
  }, [
    sessionId,
    storageReady,
    lineSpecs,
    setByItemAllocations,
    existingSplit,
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
  }, [splitMode, personCount, splitPeople, guestName]);

  useEffect(() => {
    if (!storageReady || !sessionId) return;
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
        byItemAllocations,
      });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    storageReady,
    restaurantId,
    sessionId,
    existingSplit,
    collectedPayments.length,
    splitMode,
    personCount,
    splitPeople,
    byItemAllocations,
  ]);

  const collectedLedgerActive = collectedPayments.length > 0;
  /** Server snapshot at page load — paid floors must not follow client submit state. */
  const lockAnchorSplit = existingSplit;
  const splitLocked = useMemo(
    () => isCheckoutSplitLocked(lockAnchorSplit, collectedLedgerActive),
    [lockAnchorSplit, collectedLedgerActive],
  );
  /** Mode chips: money lock or even/by_item already submitted. */
  const modeChipsLocked = useMemo(
    () =>
      splitLocked || isStaffCheckoutSplitModeFrozen(lockAnchorSplit),
    [splitLocked, lockAnchorSplit],
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

  /** Sole by-item draft roster: ledger `result` order + party_id (same as collect person_index). */
  const byItemLedgerRoster = useMemo(() => {
    const rows = continuationSplit?.result ?? existingSplit?.result ?? [];
    return rows
      .filter((row) => !!row.name.trim())
      .map((row) => ({
        name: row.name,
        partyId: row.party_id?.trim() || undefined,
      }));
  }, [continuationSplit?.result, existingSplit?.result]);

  const byItemPersonOrder = useMemo(
    () => byItemLedgerRoster.map((row) => row.name),
    [byItemLedgerRoster],
  );
  const byItemPersonPartyIds = useMemo(
    () => byItemLedgerRoster.map((row) => row.partyId),
    [byItemLedgerRoster],
  );

  const splitDraftInput = useMemo<BillSplitDraftInput>(
    () => ({
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      byItemDraftRows: byItemAllocations,
      parsedByItemAllocations,
      lang,
      byItemPersonOrder,
      byItemPersonPartyIds,
    }),
    [
      splitMode,
      total,
      orderLines,
      lineSpecs,
      personCount,
      splitPeople,
      byItemAllocations,
      parsedByItemAllocations,
      lang,
      byItemPersonOrder,
      byItemPersonPartyIds,
    ],
  );

  const { results: computedResults, validation: splitValidation } = useMemo(
    () => validateSplitDraft(splitDraftInput),
    [splitDraftInput],
  );

  const results = computedResults;

  const splitDisplayRows = useMemo(
    () => buildCustomerSplitDisplayRows(results, collectedPayments, discountRate, total),
    [results, collectedPayments, discountRate, total],
  );

  const syncNameAcrossModes = useCallback((index: number, name: string) => {
    setSplitPeople((prev) => prev.map((person, idx) => (idx === index ? { ...person, name } : person)));
  }, []);

  const handleSplitModeClick = useCallback(
    (mode: SplitMode) => {
      if (submitting || modeChipsLocked) return;
      if (
        !staffMayChangeCheckoutSplitMode({
          existing: lockAnchorSplit,
          nextMode: mode,
          hasCollectedLedger: collectedLedgerActive,
        })
      ) {
        return;
      }
      // Same chip: keep selection (no null toggle that paints 整桌 while DB is even).
      if (splitMode === mode || (mode === 'whole_table' && splitMode == null)) {
        return;
      }
      setSplitMode(mode === 'whole_table' ? null : mode);
      if (mode === 'even') {
        setPersonCount(
          splitDraftPersonCount(Math.max(personCount, splitPeople.length, 1)),
        );
      }
    },
    [
      submitting,
      modeChipsLocked,
      lockAnchorSplit,
      collectedLedgerActive,
      splitMode,
      personCount,
      splitPeople,
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

  const decrementPersonCount = useCallback(() => {
    const n = splitDraftPersonCount(personCount - 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      const names = ensureSplitPersonNames(
        prev.map((person) => person.name),
        n,
        guestName,
      );
      const next = slotsFromNames(names, prev);
      return next;
    });
  }, [personCount, guestName]);

  const incrementPersonCount = useCallback(() => {
    const n = splitDraftPersonCount(personCount + 1);
    setPersonCount(n);
    setSplitPeople((prev) => {
      const names = ensureSplitPersonNames(
        prev.map((person) => person.name),
        n,
        guestName,
      );
      const next = slotsFromNames(names, prev);
      return next;
    });
  }, [personCount, guestName]);

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
    splitLocked,
    modeChipsLocked,
    lockedPersonLineMins,
    lockedPersonNames,
    splitDraftInput,
    splitValidation,
    results,
    splitDisplayRows,
    byItemAllocations,
    setByItemAllocations,
    renameByItemConsumer,
    recordStaffByItemShareOmit,
    clearStaffByItemShareOmit,
    buildPersonsForSubmit: buildPersonsForSubmitCommitted,
    resolveSplitDraftInputForSubmit,
    handleSplitModeClick,
    editingSplitNameIndex,
    editingSplitNameValue,
    setEditingSplitNameValue,
    startInlineRename,
    commitInlineRename,
    decrementPersonCount,
    incrementPersonCount,
    setEditingSplitNameIndex,
  };
}
