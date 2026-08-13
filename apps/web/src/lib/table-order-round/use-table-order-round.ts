'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useDebouncedPostgresRealtimeRefresh } from '@/lib/use-restaurant-realtime-refresh';
import type { SushiRoundSettings } from '@/lib/table-order-round/settings';
import type { RoundSnapshot } from '@/lib/table-order-round/types';
import {
  deleteRoundLineClient,
  fetchRoundSnapshot,
  finalizeRoundClient,
  ownLineId,
  ownLineQty,
  submitRoundRequestClient,
  type RoundApiSnapshot,
  upsertRoundLineClient,
  voteRoundClient,
} from '@/lib/table-order-round/client-api';
import { ensureGuestClientId } from '@/lib/table-order-round/guest-client';

const LINE_DEBOUNCE_MS = 400;
const REALTIME_DEBOUNCE_MS = 2000;

export type SushiRoundView = RoundSnapshot & {
  guestClientId: string;
  settings: SushiRoundSettings;
};

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

/** Sole customer hook: Realtime → debounced GET + line debounce / vote / finalize. */
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
  const pendingQtyRef = useRef<Map<string, number>>(new Map());
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const seenSubmitRequestIdsRef = useRef<Set<string>>(new Set());
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deferModalOpen, setDeferModalOpen] = useState(false);
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
    // Avoid new-object churn: settings in refresh deps previously caused GET → setSettings → refresh → GET loop (429).
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
    const list = [
      { table: 'table_order_rounds', filter: `session_id=eq.${sessionId}` },
    ];
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

  // When round id first appears, line/vote bindings remount; catch up once so we do not
  // miss INSERTs that landed before the round_id filter was subscribed.
  const prevRoundIdRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevRoundIdRef.current;
    prevRoundIdRef.current = roundId;
    if (!realtimeEnabled || !roundId || prev === roundId) return;
    if (prev != null) return;
    void refresh();
  }, [realtimeEnabled, refresh, roundId]);

  const flushLineQty = useCallback(
    async (menuItemId: string, qty: number) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      if (qty < 1) {
        const lineId = ownLineId(snapshot.lines, menuItemId, guestClientId);
        if (!lineId) {
          pendingQtyRef.current.delete(menuItemId);
          return { ok: true as const, snapshot };
        }
        const result = await deleteRoundLineClient({
          slug,
          tableId,
          guestClientId,
          lineId,
          settings,
        });
        if (!result.ok) return result;
        pendingQtyRef.current.delete(menuItemId);
        applySnapshot(result.snapshot);
        return result;
      }
      const result = await upsertRoundLineClient({
        slug,
        tableId,
        guestClientId,
        menuItemId,
        qty,
        settings,
      });
      if (!result.ok) return result;
      pendingQtyRef.current.delete(menuItemId);
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, guestClientId, settings, slug, snapshot, tableId],
  );

  const scheduleLineQty = useCallback(
    (menuItemId: string, qty: number) => {
      pendingQtyRef.current.set(menuItemId, qty);
      const existing = debounceTimersRef.current.get(menuItemId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(menuItemId);
        const pending = pendingQtyRef.current.get(menuItemId);
        if (pending === undefined) return;
        void flushLineQty(menuItemId, pending);
      }, LINE_DEBOUNCE_MS);
      debounceTimersRef.current.set(menuItemId, timer);
    },
    [flushLineQty],
  );

  useEffect(() => {
    const timers = debounceTimersRef.current;
    return () => {
      for (const timer of Array.from(timers.values())) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  const displayQtyForItem = useCallback(
    (menuItemId: string) => {
      if (!guestClientId) return 0;
      if (pendingQtyRef.current.has(menuItemId)) {
        return pendingQtyRef.current.get(menuItemId) ?? 0;
      }
      return ownLineQty(snapshot.lines, menuItemId, guestClientId);
    },
    [guestClientId, snapshot.lines],
  );

  /** Optimistic local qty for steppers (forces re-render via bump). */
  const [qtyEpoch, setQtyEpoch] = useState(0);
  const setFreeItemQty = useCallback(
    (menuItemId: string, nextQty: number) => {
      const qty = Math.max(0, Math.floor(nextQty));
      pendingQtyRef.current.set(menuItemId, qty);
      setQtyEpoch((n) => n + 1);
      scheduleLineQty(menuItemId, qty);
    },
    [scheduleLineQty],
  );

  const submitRequest = useCallback(
    async (geo?: { latitude?: number | null; longitude?: number | null }) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await submitRoundRequestClient({
        slug,
        tableId,
        guestClientId,
        settings,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, guestClientId, settings, slug, tableId],
  );

  const vote = useCallback(
    async (value: 'confirm' | 'defer') => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await voteRoundClient({
        slug,
        tableId,
        guestClientId,
        vote: value,
        settings,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      if (value === 'defer' || result.snapshot.deferred) {
        setConfirmModalOpen(false);
        setDeferModalOpen(false);
      }
      return result;
    },
    [applySnapshot, guestClientId, settings, slug, tableId],
  );

  const finalize = useCallback(
    async (geo?: { latitude?: number | null; longitude?: number | null }) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const result = await finalizeRoundClient({
        slug,
        tableId,
        guestClientId,
        settings,
        latitude: geo?.latitude,
        longitude: geo?.longitude,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      setConfirmModalOpen(false);
      return result;
    },
    [applySnapshot, guestClientId, settings, slug, tableId],
  );

  // Deadline timer → single finalize attempt
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

  return {
    guestClientId,
    snapshot,
    settings,
    qtyEpoch,
    displayQtyForItem,
    setFreeItemQty,
    refresh,
    submitRequest,
    vote,
    finalize,
    confirmModalOpen,
    setConfirmModalOpen,
    deferModalOpen,
    setDeferModalOpen,
  };
}
