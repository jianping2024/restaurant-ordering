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
  ownLineNote,
  ownLineQty,
  ownLinesQtyTotal,
  submitRoundRequestClient,
  type RoundApiSnapshot,
  upsertRoundLineClient,
} from '@/lib/table-order-round/client-api';
import { canMutateRoundLines, isCooldownActive } from '@/lib/table-order-round/status';
import { ensureGuestClientId } from '@/lib/table-order-round/guest-client';

const REALTIME_DEBOUNCE_MS = 2000;

function emptySnapshot(settings: SushiRoundSettings): RoundSnapshot {
  return {
    round: null,
    lines: [],
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

/** Sole customer hook: Realtime → GET; cart 下单 upserts own lines; countdown finalize. */
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
  /**
   * Round GET ready token: ready only when it matches the current sessionId
   * (avoids one stale-ready frame after 换台/并台 session swap).
   */
  const [snapshotReadyToken, setSnapshotReadyToken] = useState<{
    sessionId: string | null;
    ready: boolean;
  }>({ sessionId: null, ready: false });
  const [settings, setSettings] = useState(initialSettings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const seenPeerSubmitIdsRef = useRef<Set<string>>(new Set());
  const selfStartedSubmitIdsRef = useRef<Set<string>>(new Set());
  const [peerNotifyOpen, setPeerNotifyOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled) return;
    setGuestClientId(ensureGuestClientId(restaurantId, tableId));
  }, [enabled, restaurantId, tableId]);

  useEffect(() => {
    setSnapshotReadyToken({ sessionId, ready: false });
    setSnapshot(emptySnapshot(settingsRef.current));
  }, [enabled, restaurantId, tableId, sessionId]);

  const applySnapshot = useCallback((next: RoundApiSnapshot) => {
    setSnapshot({
      round: next.round,
      lines: next.lines,
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
        prev.sushi_menu_vegetarian_filter_enabled === n.sushi_menu_vegetarian_filter_enabled &&
        prev.sushi_menu_allergen_filter_enabled === n.sushi_menu_allergen_filter_enabled
      ) {
        return prev;
      }
      return n;
    });
    const submitId = next.round?.submit_request_id;
    if (next.round?.status === 'pending_confirm' && submitId) {
      if (
        !selfStartedSubmitIdsRef.current.has(submitId) &&
        !seenPeerSubmitIdsRef.current.has(submitId)
      ) {
        seenPeerSubmitIdsRef.current.add(submitId);
        setPeerNotifyOpen(true);
      }
    } else if (next.round?.status !== 'pending_confirm') {
      setPeerNotifyOpen(false);
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
    const applied = applySnapshot(result.snapshot);
    setSnapshotReadyToken({ sessionId, ready: true });
    return applied;
  }, [applySnapshot, enabled, guestClientId, sessionId, slug, tableId]);

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
      list.push({ table: 'table_order_round_lines', filter: `round_id=eq.${roundId}` });
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
    if (!realtimeEnabled) return;
    if (prevRoundIdRef.current === roundId) return;
    prevRoundIdRef.current = roundId;
    void refresh();
  }, [realtimeEnabled, refresh, roundId]);

  const commitCartToRound = useCallback(
    async (items: RoundCartCommitItem[]) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      let last: RoundApiSnapshot | null = null;
      for (const item of items) {
        const result = await upsertRoundLineClient({
          slug,
          tableId,
          guestClientId,
          menuItemId: item.menuItemId,
          qty: item.qty,
          note: item.note,
          qtyMode: 'add',
          settings: settingsRef.current,
        });
        if (!result.ok) return result;
        last = result.snapshot;
        applySnapshot(result.snapshot);
      }
      return { ok: true as const, snapshot: last! };
    },
    [applySnapshot, guestClientId, slug, tableId],
  );

  /** 核单: set absolute qty for own line (keeps note). qty <= 0 deletes. */
  const setOwnRoundLineQty = useCallback(
    async (lineId: string, nextQty: number) => {
      if (!guestClientId) return { ok: false as const, error: 'invalid_guest_client_id' };
      const line = snapshot.lines.find((l) => l.id === lineId);
      if (!line || line.guest_client_id !== guestClientId) {
        return { ok: false as const, error: 'line_not_owned' };
      }
      const qty = Math.floor(Number(nextQty));
      if (!Number.isFinite(qty) || qty <= 0) {
        const result = await deleteRoundLineClient({
          slug,
          tableId,
          guestClientId,
          lineId,
          settings: settingsRef.current,
        });
        if (!result.ok) return result;
        applySnapshot(result.snapshot);
        return result;
      }
      const result = await upsertRoundLineClient({
        slug,
        tableId,
        guestClientId,
        menuItemId: line.menu_item_id,
        qty,
        note: line.note ?? '',
        qtyMode: 'set',
        settings: settingsRef.current,
      });
      if (!result.ok) return result;
      applySnapshot(result.snapshot);
      return result;
    },
    [applySnapshot, guestClientId, slug, snapshot.lines, tableId],
  );

  const submitRequest = useCallback(
    async (geo?: { latitude?: number; longitude?: number }) => {
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
      const submitId = result.snapshot.round?.submit_request_id;
      if (submitId) selfStartedSubmitIdsRef.current.add(submitId);
      applySnapshot(result.snapshot);
      setPeerNotifyOpen(false);
      return result;
    },
    [applySnapshot, guestClientId, slug, tableId],
  );

  const finalize = useCallback(async () => {
    if (!guestClientId) return;
    const result = await finalizeRoundClient({
      slug,
      tableId,
      guestClientId,
      settings: settingsRef.current,
    });
    if (!result.ok) return result;
    applySnapshot(result.snapshot);
    return result;
  }, [applySnapshot, guestClientId, slug, tableId]);

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

  /** When table cooldown ends (or snapshot still shows expired cooldown), refresh so GET settles → empty basket. */
  const cooldownUntil = snapshot.round?.status === 'cooldown' ? snapshot.round.cooldown_until : null;
  const cooldownRoundId = snapshot.round?.status === 'cooldown' ? snapshot.round.id : null;
  const expiredCooldownSettledKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || !cooldownRoundId || !cooldownUntil) {
      expiredCooldownSettledKeyRef.current = null;
      return;
    }
    if (isCooldownActive('cooldown', cooldownUntil)) {
      const untilMs = Date.parse(cooldownUntil);
      const ms = Number.isFinite(untilMs) ? Math.max(0, untilMs - Date.now()) + 150 : 0;
      const timer = setTimeout(() => {
        void refresh();
      }, ms);
      return () => clearTimeout(timer);
    }
    const key = `${cooldownRoundId}:${cooldownUntil}`;
    if (expiredCooldownSettledKeyRef.current === key) return;
    expiredCooldownSettledKeyRef.current = key;
    void refresh();
  }, [cooldownRoundId, cooldownUntil, enabled, refresh]);

  const roundStatus = snapshot.round?.status;
  const roundReviewActive =
    roundStatus === 'collecting' ||
    roundStatus === 'pending_confirm' ||
    roundStatus === 'finalize_failed' ||
    (roundStatus == null && snapshot.lines.length > 0);
  const ownReviewQty = roundReviewActive ? ownLinesQtyTotal(snapshot.lines, guestClientId) : 0;
  const tableReviewQty = roundReviewActive ? snapshot.lines_qty_total : 0;
  const ownLinesEditable =
    roundStatus != null ? canMutateRoundLines(roundStatus) : snapshot.lines.length > 0;
  const snapshotReady =
    snapshotReadyToken.ready && snapshotReadyToken.sessionId === sessionId;

  return {
    guestClientId,
    snapshot,
    snapshotReady,
    settings,
    ownReviewQty,
    tableReviewQty,
    ownLinesEditable,
    ownLineQty: (menuItemId: string) => ownLineQty(snapshot.lines, menuItemId, guestClientId),
    ownLineNote: (menuItemId: string) => ownLineNote(snapshot.lines, menuItemId, guestClientId),
    setOwnRoundLineQty,
    commitCartToRound,
    submitRequest,
    finalize,
    refresh,
    peerNotifyOpen,
    setPeerNotifyOpen,
  };
}
