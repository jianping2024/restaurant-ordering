'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buffetFormAlignKey,
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
 * Idle / no-buffet session preselects the default package at 0 + 0.
 */
function draftFromAlignState(
  alignState: BuffetFormAlignState,
): TableBuffetSelection | null | undefined {
  if (alignState.mode === 'pending') return undefined;
  if (alignState.mode === 'occupied') return alignState.selection;
  return alignState.defaultBuffetId
    ? { buffetId: alignState.defaultBuffetId, adults: 0, children: 0 }
    : null;
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

  const [draft, setDraft] = useState<TableBuffetSelection | null>(
    () => draftFromAlignState(alignState) ?? null,
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

  const alignedDraft = useMemo(() => draftFromAlignState(alignState), [alignState]);
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

  const resolvedRef = useRef(resolvedByBuffetId);
  resolvedRef.current = resolvedByBuffetId;

  /** Pick the table's one package; headcount carries over (a side its rule disables → 0). */
  const selectBuffet = useCallback((buffetId: string) => {
    setDraft((prev) => selectTableBuffetDraft(prev, buffetId, resolvedRef.current[buffetId]));
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
