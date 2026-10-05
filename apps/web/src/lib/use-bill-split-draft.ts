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
  submitted: boolean;
  persistedResult: SplitResult[] | null;
  submitting: boolean;
  lang: UILanguage;
  /** Guest phone vs staff checkout — two editors, one submit wire. */
  byItemEditor: BillSplitByItemEditor;
  /** Bill-level discount % — settlement display obligation is fold-discounted. */
  discountRate?: number;
  /**
   * Individual-checkout session (guest editor): ticket keys this phone cannot edit.
   * The plan is shared, so the split mode is locked once any ticket exists.
   */
  individualReadOnlyKeys?: ReadonlySet<string> | null;
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
    individualReadOnlyKeys,
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
    extraLockedKeys: individualReadOnlyKeys ?? undefined,
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
  const guestRestoreLocalDraft = guestByItem.restoreLocalDraft;
  const recordStaffByItemShareOmit =
    byItemEditor === 'staff' ? staffByItem.recordStaffByItemShareOmit : undefined;
  const clearStaffByItemShareOmit =
    byItemEditor === 'staff' ? staffByItem.clearStaffByItemShareOmit : undefined;

  useLayoutEffect(() => {
    if (!sessionId || !storageReady || byItemLocalAppliedRef.current) return;

    const draft = loadedLocalDraftRef.current;
    const canRestore = shouldRestoreBillSplitLocalDraft({
      existingSplit,
      submitted,
      collectedPaymentCount: collectedPayments.length,
    });
    const action = resolveByItemLocalDraftApplyAction({
      byItemEditor,
      canRestore,
      hasServerItemShares: billSplitHasServerItemShares(existingSplit),
      hasByItemLocalDraft: draft?.splitMode === 'by_item',
    });

    byItemLocalAppliedRef.current = true;
    // leave_reconcile: guest|staff sole hydrate — never setByItemAllocations({}) here.
    if (action !== 'apply_local' || !draft) return;
    if (byItemEditor === 'guest') {
      guestRestoreLocalDraft(draft.byItemAllocations);
      return;
    }
    setByItemAllocations(withDefaultByItemLineRows(draft.byItemAllocations, lineSpecs));
  }, [
    sessionId,
    storageReady,
    lineSpecs,
    byItemEditor,
    guestRestoreLocalDraft,
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
    byItemAllocations,
  ]);

  const collectedLedgerActive = collectedPayments.length > 0;
  /** Server snapshot at page load — paid floors must not follow client submit state. */
  const lockAnchorSplit = existingSplit;
  const splitLocked = useMemo(
    () =>
      isCheckoutSplitLocked(lockAnchorSplit, collectedLedgerActive) ||
      // Individual checkout: one shared plan — the mode cannot change once a ticket exists.
      (!!individualReadOnlyKeys && (lockAnchorSplit?.persons?.length ?? 0) > 0),
    [lockAnchorSplit, collectedLedgerActive, individualReadOnlyKeys],
  );
  const lockedPersonLineMins = useMemo(
    () =>
      splitLocked
        ? buildLockedPersonLineMins(
            lockAnchorSplit,
            collectedLedgerActive,
            collectedPayments,
            individualReadOnlyKeys ?? undefined,
          )
        : { menu: new Map(), buffet: new Map() },
    [splitLocked, lockAnchorSplit, collectedLedgerActive, collectedPayments, individualReadOnlyKeys],
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
    () =>
      validateSplitDraft(splitDraftInput, {
        // Individual checkout: a guest may call with part of the pool still unclaimed.
        allowPartialByItem: !!individualReadOnlyKeys,
        ignoreUnnamedRows: !!individualReadOnlyKeys,
      }),
    [splitDraftInput, individualReadOnlyKeys],
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
          splitDraftPersonCount(Math.max(personCount, splitPeople.length)),
        );
      }
    },
    [
      submitting,
      splitLocked,
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
