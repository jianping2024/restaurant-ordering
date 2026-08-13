'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDebouncedPostgresRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';
import type { RoundSnapshot } from '@/lib/table-order-round/types';
import {
  fetchRoundSnapshot,
  finalizeRoundClient,
  ownLineNote,
  ownLineQty,
  ownLinesQtyTotal,
  submitRoundRequestClient,
  type RoundApiSnapshot,
  upsertRoundLineClient,
  voteRoundClient,
} from '@/lib/table-order-round/client-api';
import { ensureGuestClientId } from '@/lib/table-order-round/guest-client';
import { mergeAppendCartNotes } from '@/types';

const REALTIME_DEBOUNCE_MS = 2000;

function emptySnapshot(settings: SushiRoundSettings): RoundSnapshot {
  return {
    round: null,
    lines: [],
    votes: [],
    settings,
    live_guest_count: 0,
    round_cap_total: 0,
    lines_qty_total: 0,
  };
}

export type RoundCartCommitItem = {
  menuItemId: string;
  qty: number;
  note: string;
};

/** Sole customer hook: Realtime → GET; cart 下单 upserts own lines; vote / finalize. */
export function useTableOrderRound(params: {
  slug: string;
  restaurantId: string;
  tableId: string;
  sessionId: string | null;
  enabled: boolean;
  initialSettings: SushiRoundSettings;
}) {
  const { slug, restaurantId, tableId, sessionId, enabled, initialSettings } = params;
  const [guestClientId, setGuestClientId] = useState('');
  const [snapshot, setSnapshot] = useState<RoundSnapshot>(() => emptySnapshot(initialSettings));
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const seenSubmitRequestIdsRef = useRef<Set<string>>(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deferModalOpen, setDeferModalOpen] = useState(false);
  const [lastKitchenSend, setLastKitchenSend] = useState<{
    order_id: string;
    batch_id?: string;
    enqueue_token: string;
  } | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled) return;
    setGuestClientId(ensureGuestClientId(restaurantId, tableId));
  }, [enabled, restaurantId, tableId]);

  const applySnapshot = useCallback((next: RoundApiSnapshot) => {
    setSnapshot({
      round: next.round,
      lines: next.lines,
      votes: next.votes,
      settings: next.settings,
      live_guest_count: next.live_guest_count,
      round_cap_total: next.round_cap_total,
      lines_qty_total: next.lines_qty_total,
    });
    setSettings((prev) => {
      const n = next.settings;
      if (
        prev.sushi_round_ordering_enabled === n.sushi_round_ordering_enabled &&
        prev.sushi_per_person_per_round_cap === n.sushi_per_person_per_round_cap &&
        prev.sushi_round_confirm_timeout_seconds === n.sushi_round_confirm_timeout_seconds &&
        prev.sushi_round_cooldown_seconds === n.sushi_round_cooldown_seconds &&
        prev.sushi_round_defer_cooldown_seconds === n.sushi_round_defer_cooldown_seconds
      ) {
        return prev;
      }
      return n;
    });
    const submitId = next.round?.submit_request_id;
    if (next.round?.status === 'pending_confirm' && submitId) {
      if (!seenSubmitRequestIdsRef.current.has(submitId)) {
        seenSubmitRequestIdsRef.current.add(submitId);
        setConfirmModalOpen(true);
      }
    } else if (next.round?.status !== 'pending_confirm') {
      setConfirmModalOpen(false);
      setDeferModalOpen(false);
    }
    if (next.finalized && next.order_id && next.enqueue_token) {
      setLastKitchenSend({
        order_id: next.order_id,
        batch_id: next.batch_id,
        enqueue_token: next.enqueue_token,
      });
    }
    return next;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled || !guestClientId) return null;
    const result = await fetchRoundSnapshot({
      slug,
      tableId,
      guestClientId,
      settings: settingsRef.current,
    });
    if (!result.ok) return null;
    return applySnapshot(result.snapshot);
  }, [applySnapshot, enabled, guestClientId, slug, tableId]);

  useEffect(() => {
    if (!enabled || !guestClientId) return;
    void refresh();
  }, [enabled, guestClientId, refresh]);

  const roundId = snapshot.round?.id ?? null;
  const realtimeEnabled = enabled && Boolean(sessionId) && Boolean(guestClientId);
  const channelKey = `sushi-round:${sessionId ?? 'none'}:${roundId ?? 'none'}`;
  const bindings = useMemo(() => {
    if (!sessionId) return [];
    const list = [{ table: 'table_order_rounds', filter: `session_id=eq.${sessionId}` }];
    if (roundId) {
      list.push(
        { table: 'table_order_round_lines', filter: `round_id=eq.${roundId}` },
        { table: 'table_order_round_votes', filter: `round_id=eq.${roundId}` },
      );
    }
    return list;
  }, [roundId, sessionId]);

  useDebouncedPostgresRealtimeRefresh(
    supabase,
    channelKey,
    realtimeEnabled,
    bindings,
    () => {
      void refresh();
    },
    REALTIME_DEBOUNCE_MS,
  );

  const prevRoundIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevRoundIdRef.current;
    prevRoundIdRef.current = roundId;
    if (!realtimeEnabled || !roundId || prev === roundId) return;
    if (prev != null) return;
    void refresh();
  }, [realtimeEnabled, refresh, roundId]);

  const commitCartLines = useCallback(
    async (items: RoundCartCommitItem[]) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      let lines = snapshot.lines;
      for (const item of items) {
        const addQty = Math.max(0, Math.floor(item.qty));
        if (addQty < 1) continue;
        const nextQty = ownLineQty(lines, item.menuItemId, guestClientId) + addQty;
        const note = mergeAppendCartNotes(
          ownLineNote(lines, item.menuItemId, guestClientId),
          item.note,
        );
        const result = await upsertRoundLineClient({
          slug,
          tableId,
          guestClientId,
          menuItemId: item.menuItemId,
          qty: nextQty,
          note,
          settings: settingsRef.current,
        });
        if (!result.ok) return result;
        applySnapshot(result.snapshot);
        lines = result.snapshot.lines;
      }
      return { ok: true as const };
    },
    [applySnapshot, guestClientId, slug, snapshot.lines, tableId],
  );

  const submitRequest = useCallback(
    async (geo?: { latitude?: number | null; longitude?: number | null }) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await submitRoundRequestClient({
        slug,
        tableId,
        guestClientId,
        settings: settingsRef.current,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, guestClientId, slug, tableId],
  );

  const vote = useCallback(
    async (value: 'confirm' | 'defer') => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await voteRoundClient({
        slug,
        tableId,
        guestClientId,
        vote: value,
        settings: settingsRef.current,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      if (value === 'defer' || result.snapshot.deferred) {
        setConfirmModalOpen(false);
        setDeferModalOpen(false);
      }
      return result;
    },
    [applySnapshot, guestClientId, slug, tableId],
  );

  const finalize = useCallback(
    async (geo?: { latitude?: number | null; longitude?: number | null }) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await finalizeRoundClient({
        slug,
        tableId,
        guestClientId,
        settings: settingsRef.current,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      setConfirmModalOpen(false);
      return result;
    },
    [applySnapshot, guestClientId, slug, tableId],
  );

  useEffect(() => {
    if (!enabled || snapshot.round?.status !== 'pending_confirm') return;
    const deadline = snapshot.round.submit_deadline_at;
    if (!deadline) return;
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) {
      void finalize();
      return;
    }
    const timer = setTimeout(() => {
      void finalize();
    }, ms + 200);
    return () => clearTimeout(timer);
  }, [enabled, finalize, snapshot.round?.status, snapshot.round?.submit_deadline_at]);

  const roundStatus = snapshot.round?.status;
  const roundReviewActive =
    roundStatus === 'collecting' ||
    roundStatus === 'pending_confirm' ||
    roundStatus === 'finalize_failed' ||
    (roundStatus == null && snapshot.lines.length > 0);
  const ownReviewQty = roundReviewActive ? ownLinesQtyTotal(snapshot.lines, guestClientId) : 0;

  return {
    guestClientId,
    snapshot,
    settings,
    ownReviewQty,
    commitCartLines,
    refresh,
    submitRequest,
    vote,
    finalize,
    lastKitchenSend,
    confirmModalOpen,
    setConfirmModalOpen,
    deferModalOpen,
    setDeferModalOpen,
  };
}
