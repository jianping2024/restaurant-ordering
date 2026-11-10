'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buffetFormAlignKey,
  buffetGuestRuleFor,
  ensureTableBuffetDraftMinGuests,
  selectTableBuffetDraft,
  type BuffetFormAlignState,
  type ResolvedBuffetPriceRow,
  type TableBuffetSelection,
} from '@/lib/buffet-order';
import type { Buffet } from '@/types';

type Params = {
  tableId: string;
  sessionId: string | null;
  alignState: BuffetFormAlignState;
  activeBuffets: Buffet[];
  /**
   * Authoritative unit prices for the packages on screen (openable snapshot + locked
   * fill for the table's current package). Not resolved per package in this hook.
   */
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>;
};

/**
 * Draft the form should show for an align state; undefined while table context is pending.
 * Idle / no-buffet session preselects the default package via sole `selectTableBuffetDraft`
 * (0+0 then raise to min when the package requires it). Occupied keeps server headcount as-is.
 */
function draftFromAlignState(
  alignState: BuffetFormAlignState,
  activeBuffets: Buffet[],
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
): TableBuffetSelection | null | undefined {
  if (alignState.mode === 'pending') return undefined;
  if (alignState.mode === 'occupied') return alignState.selection;
  if (!alignState.defaultBuffetId) return null;
  const buffet = activeBuffets.find((b) => b.id === alignState.defaultBuffetId) ?? null;
  return selectTableBuffetDraft(
    null,
    alignState.defaultBuffetId,
    buffetPricesByBuffetId[alignState.defaultBuffetId],
    buffet,
  );
}

function resolvedPricesForActiveBuffets(
  buffetPricesByBuffetId: Record<string, ResolvedBuffetPriceRow | null>,
  activeBuffetIds: string[],
): Record<string, ResolvedBuffetPriceRow | null> {
  const next: Record<string, ResolvedBuffetPriceRow | null> = {};
  for (const buffetId of activeBuffetIds) {
    next[buffetId] = buffetPricesByBuffetId[buffetId] ?? null;
  }
  return next;
}

/**
 * One-buffet table draft — aligns from alignState when table context is authoritative.
 * Option unit prices come from the caller (openable snapshot); this hook does not
 * call `resolve_buffet_prices` or poll.
 */
export function useWaiterTableBuffetForm({
  tableId,
  sessionId,
  alignState,
  activeBuffets,
  buffetPricesByBuffetId,
}: Params) {
  const activeBuffetIds = useMemo(() => activeBuffets.map((b) => b.id), [activeBuffets]);
  const activeBuffetsRef = useRef(activeBuffets);
  activeBuffetsRef.current = activeBuffets;

  const [draft, setDraft] = useState<TableBuffetSelection | null>(
    () => draftFromAlignState(alignState, activeBuffets, buffetPricesByBuffetId) ?? null,
  );
  const [resolvedByBuffetId, setResolvedByBuffetId] = useState<
    Record<string, ResolvedBuffetPriceRow | null>
  >(() =>
    resolvedPricesForActiveBuffets(buffetPricesByBuffetId, activeBuffets.map((b) => b.id)),
  );
  const lastAlignedKeyRef = useRef<string | null>(null);

  const alignKey = useMemo(
    () => buffetFormAlignKey(tableId, sessionId, alignState),
    [alignState, sessionId, tableId],
  );

  const alignedDraft = useMemo(
    () => draftFromAlignState(alignState, activeBuffets, buffetPricesByBuffetId),
    [alignState, activeBuffets, buffetPricesByBuffetId],
  );
  const alignedDraftRef = useRef(alignedDraft);
  alignedDraftRef.current = alignedDraft;

  useEffect(() => {
    if (lastAlignedKeyRef.current === alignKey) return;
    lastAlignedKeyRef.current = alignKey;
    if (alignedDraft !== undefined) setDraft(alignedDraft);
  }, [alignKey, alignedDraft]);

  /** Drop an unsaved edit and show the table's authoritative headcount again. */
  const resetDraftToAligned = useCallback(() => {
    const next = alignedDraftRef.current;
    if (next !== undefined) setDraft(next);
  }, []);

  useEffect(() => {
    setResolvedByBuffetId(
      resolvedPricesForActiveBuffets(buffetPricesByBuffetId, activeBuffetIds),
    );
  }, [activeBuffetIds, buffetPricesByBuffetId]);

  /**
   * Cold open: openable snapshot may land after the first idle draft (0+0).
   * Re-apply sole min bump when package options/prices refresh — never on occupied
   * (server headcount stays authoritative until the waiter taps).
   */
  useEffect(() => {
    if (alignState.mode === 'occupied' || alignState.mode === 'pending') return;
    setDraft((prev) => {
      if (!prev) return prev;
      const buffet = activeBuffets.find((b) => b.id === prev.buffetId);
      if (!buffet) return prev;
      const next = ensureTableBuffetDraftMinGuests(
        prev,
        buffetGuestRuleFor(buffet, resolvedByBuffetId[prev.buffetId]),
      );
      if (next.adults === prev.adults && next.children === prev.children) return prev;
      return next;
    });
  }, [activeBuffets, alignState.mode, resolvedByBuffetId]);

  const resolvedRef = useRef(resolvedByBuffetId);
  resolvedRef.current = resolvedByBuffetId;

  /** Pick the table's one package; headcount carries over, then raises to package minimum. */
  const selectBuffet = useCallback((buffetId: string) => {
    const buffet = activeBuffetsRef.current.find((b) => b.id === buffetId) ?? null;
    setDraft((prev) =>
      selectTableBuffetDraft(prev, buffetId, resolvedRef.current[buffetId], buffet),
    );
  }, []);

  const setBuffetGuestCount = useCallback((which: 'adults' | 'children', value: number) => {
    const n = Math.max(0, Math.floor(value));
    setDraft((prev) => (prev ? { ...prev, [which]: n } : prev));
  }, []);

  return {
    draft,
    selectBuffet,
    setBuffetGuestCount,
    resetDraftToAligned,
    resolvedByBuffetId,
    /** Snapshot prices — never a loading flicker for openable-backed surfaces. */
    priceLoading: false,
  };
}
