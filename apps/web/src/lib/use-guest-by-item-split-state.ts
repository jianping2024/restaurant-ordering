'use client';

/**
 * Sole guest (customer phone) by-item *editing* state.
 * Dish-row model: unnamed payer slots + add-consumer must persist in working map.
 * Does not use staff committed/draft dual-layer (that is staff-only).
 * Submit still goes through buildSplitPersonsFromAllocations → same bill wire as staff.
 * Party ids: sole normalize {@link normalizeByItemDraftPartyIds} on every write.
 * Sync: sole {@link reconcileGuestByItemAllocations} — locked from server, unpaid local kept,
 * new lines only append defaults (never wipe local edits when lineSpecs expand).
 * Refresh: sole {@link restoreGuestByItemLocalDraft} via `restoreLocalDraft`.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import {
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  countByItemAllocationProgress,
  normalizeByItemDraftPartyIds,
  withDefaultByItemLineRows,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  allocationLockedTicketKeys,
  buildByItemConsumerRowsFromPersons,
  buildLockedPersonLineMins,
} from '@/lib/checkout-split-continuation';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import { collectActiveConsumerNames } from '@/lib/consumer-name-roster';
import {
  reconcileGuestByItemAllocations,
  restoreGuestByItemLocalDraft,
} from '@/lib/guest-by-item-reconcile';
import type { BillSplit, SplitMode } from '@/types';

export function useGuestByItemSplitState(params: {
  splitMode: SplitMode | null;
  lineSpecs: ByItemLineSpec[];
  existingSplit: BillSplit | null;
  collectedPayments?: SessionCollectedPayment[];
  /** When false (staff draft page), skip all guest editor work. */
  enabled?: boolean;
  /**
   * Individual checkout: tickets this phone cannot edit (called, or held by another phone).
   * They overlay as read-only like paid tickets; this phone's own unlocked tickets stay draft.
   */
  extraLockedKeys?: ReadonlySet<string>;
  /**
   * Sole session-isolation key for this working map.
   * When it changes, wipe rows + reconcile fingerprint — never keep prior session's Alice/Bob.
   */
  draftOwnerKey?: string | null;
}) {
  const {
    splitMode,
    lineSpecs,
    existingSplit,
    collectedPayments = [],
    enabled = true,
    draftOwnerKey = null,
    extraLockedKeys,
  } = params;

  const [byItemAllocations, setByItemAllocationsState] = useState<Record<string, ByItemConsumerRow[]>>({});
  const reconciledKeyRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    reconciledKeyRef.current = null;
    setByItemAllocationsState({});
  }, [draftOwnerKey]);

  const paidLocks = useMemo(
    () =>
      buildLockedPersonLineMins(
        existingSplit,
        collectedPayments.length > 0,
        collectedPayments,
        extraLockedKeys,
      ),
    [existingSplit, collectedPayments, extraLockedKeys],
  );

  const lockedTicketKeys = useMemo(
    () => allocationLockedTicketKeys(existingSplit, collectedPayments, extraLockedKeys),
    [existingSplit, collectedPayments, extraLockedKeys],
  );
  const lockedTicketKeysRef = useRef(lockedTicketKeys);
  lockedTicketKeysRef.current = lockedTicketKeys;

  const setByItemAllocations = useCallback(
    (update: SetStateAction<Record<string, ByItemConsumerRow[]>>) => {
      if (!enabled) return;
      setByItemAllocationsState((prev) => {
        const raw = typeof update === 'function' ? update(prev) : update;
        return normalizeByItemDraftPartyIds(raw, lockedTicketKeysRef.current);
      });
    },
    [enabled],
  );

  useLayoutEffect(() => {
    if (!enabled || splitMode !== 'by_item') return;

    if (!existingSplit?.persons?.length) {
      const emptyKey = `empty:${lineSpecs.map((spec) => spec.key).join('|')}`;
      if (reconciledKeyRef.current === emptyKey) return;
      reconciledKeyRef.current = emptyKey;
      setByItemAllocationsState((prev) => {
        const next = normalizeByItemDraftPartyIds(
          withDefaultByItemLineRows(prev, lineSpecs),
          lockedTicketKeys,
        );
        return next === prev ? prev : next;
      });
      return;
    }

    if (lineSpecs.length === 0) return;

    const personsSig = JSON.stringify(existingSplit.persons);
    const lockSig = `${paidLocks.menu.size}:${paidLocks.buffet.size}`;
    const reconcileKey = `${existingSplit.id}:${lineSpecs.map((spec) => spec.key).join('|')}:${personsSig}:${lockSig}`;
    if (reconciledKeyRef.current === reconcileKey) return;
    reconciledKeyRef.current = reconcileKey;

    const serverRows = buildByItemConsumerRowsFromPersons(
      existingSplit.persons,
      lineSpecs,
      paidLocks,
    );
    setByItemAllocationsState((prev) =>
      reconcileGuestByItemAllocations({
        prev,
        serverRows,
        lineSpecs,
        lockedTicketKeys,
      }),
    );
  }, [enabled, splitMode, lineSpecs, existingSplit, paidLocks, lockedTicketKeys]);

  /** Refresh restore of this phone's local draft — sole rule {@link restoreGuestByItemLocalDraft}. */
  const restoreLocalDraft = useCallback(
    (localRows: Record<string, ByItemConsumerRow[]>) => {
      if (!enabled) return;
      const persons = existingSplit?.persons ?? [];
      const serverRows = persons.length
        ? buildByItemConsumerRowsFromPersons(persons, lineSpecs, paidLocks)
        : {};
      setByItemAllocationsState(() =>
        restoreGuestByItemLocalDraft({ localRows, serverRows, lineSpecs, lockedTicketKeys }),
      );
    },
    [enabled, existingSplit, lineSpecs, paidLocks, lockedTicketKeys],
  );

  const workingAllocations = useMemo(
    () => (enabled ? byItemAllocations : {}),
    [enabled, byItemAllocations],
  );

  const consumerRoster = useMemo(
    () => collectActiveConsumerNames(workingAllocations),
    [workingAllocations],
  );

  const parsedByItemAllocations = useMemo<ByItemLineAllocation>(
    () => buildByItemAllocationsFromRows(lineSpecs, workingAllocations),
    [lineSpecs, workingAllocations],
  );

  const byItemProgress = useMemo(
    () => countByItemAllocationProgress(lineSpecs, workingAllocations),
    [lineSpecs, workingAllocations],
  );

  const rememberConsumerName: (name: string, fromList: boolean) => void =
    useCallback(() => {}, []);

  const renameByItemConsumer = useCallback((
    oldName: string,
    newName: string,
    partyId?: string,
  ) => {
    if (!enabled) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    setByItemAllocations((prev) => {
      const next: Record<string, ByItemConsumerRow[]> = {};
      for (const [key, rows] of Object.entries(prev)) {
        next[key] = rows.map((row) => {
          if (partyId?.trim()) {
            if (row.partyId?.trim() !== partyId.trim()) return row;
            return { ...row, name: trimmed };
          }
          if (row.name.trim().toLowerCase() !== oldName.toLowerCase()) return row;
          return { ...row, name: trimmed };
        });
      }
      return next;
    });
  }, [enabled, setByItemAllocations]);

  const buildPersonsForSubmit = useCallback(
    () => buildSplitPersonsFromAllocations(parsedByItemAllocations),
    [parsedByItemAllocations],
  );

  return {
    byItemAllocations: workingAllocations,
    setByItemAllocations,
    restoreLocalDraft,
    consumerRoster,
    rememberConsumerName,
    parsedByItemAllocations,
    byItemProgress,
    renameByItemConsumer,
    buildPersonsForSubmit,
  };
}
