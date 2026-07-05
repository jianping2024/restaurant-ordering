'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient } from '@/lib/staff-board-client';
import type { WaiterBoardData } from '@/lib/staff-board';
import {
  useRestaurantRealtimeRefresh,
  useRestaurantStaffEntryReconcile,
} from '@/lib/use-restaurant-realtime-refresh';
import type {
  RestaurantTableGroup,
  RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import {
  activeSessionIdByTableIdFromMeta,
  demoSessionMetaFromOrders,
  type WaiterTableSessionMeta,
} from '@/lib/waiter-board-session';
import {
  buildWaiterBoardTableSummaries,
  type WaiterBoardTableSummary,
} from '@/lib/waiter-board-snapshot';
import type { RestaurantTableRow } from '@/lib/restaurant-tables';
import {
  bootstrapWaiterBoardData,
  clearConfirmedPublishedWaiterTablePageModels,
  reconcileWaiterBoardWithPublished,
} from '@/lib/waiter-staff-mutation-sync';

function buildInitialWaiterBoardState(input: {
  initialTableSummaries: WaiterBoardTableSummary[];
  initialCheckoutRequestedTableIds: string[];
  initialSessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  initialCheckoutRequestedAtByTableId: Record<string, string>;
  initialTables: RestaurantTableRow[];
  initialGroups: RestaurantTableGroup[];
  initialMembers: RestaurantTableGroupMember[];
}) {
  return bootstrapWaiterBoardData({
    tableSummaries: input.initialTableSummaries,
    checkoutRequestedTableIds: input.initialCheckoutRequestedTableIds,
    sessionMetaByTableId: input.initialSessionMetaByTableId,
    checkoutRequestedAtByTableId: input.initialCheckoutRequestedAtByTableId,
    tables: input.initialTables,
    groups: input.initialGroups,
    members: input.initialMembers,
  });
}

function applyWaiterBoardData(
  board: WaiterBoardData,
  setters: {
    setTableSummaries: (rows: WaiterBoardTableSummary[]) => void;
    setSessionMetaByTableId: (meta: Record<string, WaiterTableSessionMeta>) => void;
    setCheckoutRequestedTableIds: (ids: string[]) => void;
    setCheckoutRequestedAtByTableId: (map: Record<string, string>) => void;
    setTables: (rows: RestaurantTableRow[]) => void;
    setGroups: (rows: RestaurantTableGroup[]) => void;
    setMembers: (rows: RestaurantTableGroupMember[]) => void;
  },
) {
  setters.setTableSummaries(board.tableSummaries);
  setters.setSessionMetaByTableId(board.sessionMetaByTableId);
  setters.setCheckoutRequestedTableIds(board.checkoutRequestedTableIds);
  setters.setCheckoutRequestedAtByTableId(board.checkoutRequestedAtByTableId);
  setters.setTables(board.tables);
  setters.setGroups(board.groups);
  setters.setMembers(board.members);
}

export function useWaiterOrders(
  restaurant: { id: string; slug: string },
  initialTableSummaries: WaiterBoardTableSummary[],
  initialCheckoutRequestedTableIds: string[],
  initialTables: RestaurantTableRow[],
  enabled: boolean,
  initialSessionMetaByTableId: Record<string, WaiterTableSessionMeta> = {},
  initialCheckoutRequestedAtByTableId: Record<string, string> = {},
  initialGroups: RestaurantTableGroup[] = [],
  initialMembers: RestaurantTableGroupMember[] = [],
  demoOrders: Order[] = [],
  skipEntryReconcile = false,
) {
  const initialBoard = buildInitialWaiterBoardState({
    initialTableSummaries,
    initialCheckoutRequestedTableIds,
    initialSessionMetaByTableId,
    initialCheckoutRequestedAtByTableId,
    initialTables,
    initialGroups,
    initialMembers,
  });
  const [tableSummaries, setTableSummaries] = useState(initialBoard.tableSummaries);
  const [checkoutRequestedTableIds, setCheckoutRequestedTableIds] = useState<string[]>(
    initialBoard.checkoutRequestedTableIds,
  );
  const [sessionMetaByTableId, setSessionMetaByTableId] = useState<
    Record<string, WaiterTableSessionMeta>
  >(initialBoard.sessionMetaByTableId);
  const [checkoutRequestedAtByTableId, setCheckoutRequestedAtByTableId] = useState<
    Record<string, string>
  >(initialBoard.checkoutRequestedAtByTableId);
  const [tables, setTables] = useState<RestaurantTableRow[]>(initialBoard.tables);
  const [groups, setGroups] = useState<RestaurantTableGroup[]>(initialBoard.groups);
  const [members, setMembers] = useState<RestaurantTableGroupMember[]>(initialBoard.members);
  const supabase = useMemo(() => createClient(), []);
  const refreshInFlightRef = useRef<Promise<WaiterBoardData | null> | null>(null);
  const reloadSeqRef = useRef(0);

  const activeSessionByTableId = useMemo(
    () => activeSessionIdByTableIdFromMeta(sessionMetaByTableId),
    [sessionMetaByTableId],
  );

  const demoTableSummaries = useMemo(() => {
    if (!demoOrders.length || !initialTables.length) return initialTableSummaries;
    const meta = demoSessionMetaFromOrders(demoOrders);
    return buildWaiterBoardTableSummaries(initialTables, demoOrders, meta);
  }, [demoOrders, initialTableSummaries, initialTables]);

  const effectiveTableSummaries = demoOrders.length ? demoTableSummaries : tableSummaries;

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    if (refreshInFlightRef.current) return refreshInFlightRef.current;

    const seq = ++reloadSeqRef.current;
    const running = (async () => {
      try {
        const { board, confirmedTableIds } = reconcileWaiterBoardWithPublished(
          await fetchWaiterBoardClient(restaurant.slug),
        );
        if (seq !== reloadSeqRef.current) return null;
        clearConfirmedPublishedWaiterTablePageModels(confirmedTableIds);
        applyWaiterBoardData(board, {
          setTableSummaries,
          setSessionMetaByTableId,
          setCheckoutRequestedTableIds,
          setCheckoutRequestedAtByTableId,
          setTables,
          setGroups,
          setMembers,
        });
        return board;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();
    refreshInFlightRef.current = running;
    return running;
  }, [enabled, restaurant.slug]);

  useRestaurantStaffEntryReconcile(enabled && !skipEntryReconcile, refresh);

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `waiter-${restaurant.id}`,
    enabled,
    () => {
      void refresh();
    },
    1200,
  );

  return {
    tableSummaries: effectiveTableSummaries,
    checkoutRequestedTableIds,
    activeSessionByTableId,
    sessionMetaByTableId,
    checkoutRequestedAtByTableId,
    tables,
    groups,
    members,
    refresh,
    supabase,
  };
}
