'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order } from '@/types';
import { fetchWaiterBoardClient, type StaffBoardFetchMode } from '@/lib/staff-board-client';
import type { WaiterBoardData } from '@/lib/staff-board';
import {
  boardSupportsBuffetOpenTable,
  type WaiterBoardOpenTableDefaults,
} from '@/lib/waiter-board-open-table';
import {
  useRestaurantRealtimeRefresh,
  useRestaurantStaffEntryReconcile,
} from '@/lib/use-restaurant-realtime-refresh';
import type {
  RestaurantTableGroup,
  RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import type { TablePartyGroup, TablePartyGroupMember } from '@/lib/table-party-groups';
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
  mergePublishedModelsIntoWaiterBoard,
  reconcileWaiterBoardWithPublished,
} from '@/lib/waiter-staff-mutation-sync';
import {
  applyWaiterSessionRelocationToBoard,
  type WaiterSessionRelocationBoardInput,
} from '@/lib/waiter-session-relocation-board';

function buildInitialWaiterBoardState(input: {
  initialTableSummaries: WaiterBoardTableSummary[];
  initialCheckoutRequestedTableIds: string[];
  initialSessionMetaByTableId: Record<string, WaiterTableSessionMeta>;
  initialCheckoutRequestedAtByTableId: Record<string, string>;
  initialTables: RestaurantTableRow[];
  initialGroups: RestaurantTableGroup[];
  initialMembers: RestaurantTableGroupMember[];
  initialParties: TablePartyGroup[];
  initialPartyMembers: TablePartyGroupMember[];
  initialOpenTableDefaults?: WaiterBoardOpenTableDefaults | null;
}) {
  const openTableDefaults = input.initialOpenTableDefaults ?? null;
  return bootstrapWaiterBoardData({
    tableSummaries: input.initialTableSummaries,
    checkoutRequestedTableIds: input.initialCheckoutRequestedTableIds,
    sessionMetaByTableId: input.initialSessionMetaByTableId,
    checkoutRequestedAtByTableId: input.initialCheckoutRequestedAtByTableId,
    tables: input.initialTables,
    groups: input.initialGroups,
    members: input.initialMembers,
    parties: input.initialParties,
    partyMembers: input.initialPartyMembers,
    restaurantHasActiveBuffets: boardSupportsBuffetOpenTable(openTableDefaults),
    openTableDefaults,
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
    setParties: (rows: TablePartyGroup[]) => void;
    setPartyMembers: (rows: TablePartyGroupMember[]) => void;
    setOpenTableDefaults: (value: WaiterBoardOpenTableDefaults | null) => void;
  },
) {
  setters.setTableSummaries(board.tableSummaries);
  setters.setSessionMetaByTableId(board.sessionMetaByTableId);
  setters.setCheckoutRequestedTableIds(board.checkoutRequestedTableIds);
  setters.setCheckoutRequestedAtByTableId(board.checkoutRequestedAtByTableId);
  setters.setTables(board.tables);
  setters.setGroups(board.groups);
  setters.setMembers(board.members);
  setters.setParties(board.parties);
  setters.setPartyMembers(board.partyMembers);
  setters.setOpenTableDefaults(board.openTableDefaults);
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
  initialOpenTableDefaults: WaiterBoardOpenTableDefaults | null = null,
  initialParties: TablePartyGroup[] = [],
  initialPartyMembers: TablePartyGroupMember[] = [],
) {
  const initialBoard = buildInitialWaiterBoardState({
    initialTableSummaries,
    initialCheckoutRequestedTableIds,
    initialSessionMetaByTableId,
    initialCheckoutRequestedAtByTableId,
    initialTables,
    initialGroups,
    initialMembers,
    initialParties,
    initialPartyMembers,
    initialOpenTableDefaults,
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
  const [parties, setParties] = useState<TablePartyGroup[]>(initialBoard.parties);
  const [partyMembers, setPartyMembers] = useState<TablePartyGroupMember[]>(
    initialBoard.partyMembers,
  );
  const [openTableDefaults, setOpenTableDefaults] = useState<WaiterBoardOpenTableDefaults | null>(
    initialBoard.openTableDefaults,
  );
  const supabase = useMemo(() => createClient(), []);
  const refreshInFlightRef = useRef<Promise<WaiterBoardData | null> | null>(null);
  const reloadSeqRef = useRef(0);
  const etagRef = useRef<string | null>(null);
  const pendingModeRef = useRef<StaffBoardFetchMode | null>(null);

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
  const supportsBuffetOpenTable = boardSupportsBuffetOpenTable(openTableDefaults);

  const boardSetters = useMemo(
    () => ({
      setTableSummaries,
      setSessionMetaByTableId,
      setCheckoutRequestedTableIds,
      setCheckoutRequestedAtByTableId,
      setTables,
      setGroups,
      setMembers,
      setParties,
      setPartyMembers,
      setOpenTableDefaults,
    }),
    [],
  );

  const refresh = useCallback(
    async (mode: StaffBoardFetchMode = 'reconcile') => {
      if (!enabled) return null;

      const prefer = (a: StaffBoardFetchMode, b: StaffBoardFetchMode): StaffBoardFetchMode =>
        a === 'reconcile' || b === 'reconcile' ? 'reconcile' : 'signal';

      pendingModeRef.current = pendingModeRef.current
        ? prefer(pendingModeRef.current, mode)
        : mode;

      if (refreshInFlightRef.current) return refreshInFlightRef.current;

      const running = (async () => {
        let lastBoard: WaiterBoardData | null = null;
        try {
          while (pendingModeRef.current) {
            const modeNow = pendingModeRef.current;
            pendingModeRef.current = null;
            const seq = ++reloadSeqRef.current;
            const result = await fetchWaiterBoardClient(restaurant.slug, {
              mode: modeNow,
              etag: etagRef.current,
            });
            if (seq !== reloadSeqRef.current) continue;

            if (result.status === 'not_modified') {
              if (result.etag) etagRef.current = result.etag;
              continue;
            }

            etagRef.current = result.etag;
            const { board, confirmedTableIds } = reconcileWaiterBoardWithPublished(result.board);
            clearConfirmedPublishedWaiterTablePageModels(confirmedTableIds);
            applyWaiterBoardData(board, boardSetters);
            lastBoard = board;
          }
          return lastBoard;
        } finally {
          refreshInFlightRef.current = null;
        }
      })();

      refreshInFlightRef.current = running;
      return running;
    },
    [boardSetters, enabled, restaurant.slug],
  );

  const applyPartyState = useCallback(
    (next: { parties: TablePartyGroup[]; partyMembers: TablePartyGroupMember[] }) => {
      setParties(next.parties);
      setPartyMembers(next.partyMembers);
    },
    [],
  );

  const currentBoardSnapshot = useCallback(
    (): WaiterBoardData => ({
      sessionMetaByTableId,
      checkoutRequestedTableIds,
      checkoutRequestedAtByTableId,
      tables,
      groups,
      members,
      parties,
      partyMembers,
      tableSummaries,
      restaurantHasActiveBuffets: boardSupportsBuffetOpenTable(openTableDefaults),
      openTableDefaults,
    }),
    [
      checkoutRequestedAtByTableId,
      checkoutRequestedTableIds,
      groups,
      members,
      openTableDefaults,
      parties,
      partyMembers,
      sessionMetaByTableId,
      tableSummaries,
      tables,
    ],
  );

  const applyBoardFromPublished = useCallback(() => {
    applyWaiterBoardData(
      mergePublishedModelsIntoWaiterBoard(currentBoardSnapshot()),
      boardSetters,
    );
  }, [boardSetters, currentBoardSnapshot]);

  const applySessionRelocationPatch = useCallback(
    (input: WaiterSessionRelocationBoardInput) => {
      applyWaiterBoardData(
        applyWaiterSessionRelocationToBoard(currentBoardSnapshot(), input),
        boardSetters,
      );
    },
    [boardSetters, currentBoardSnapshot],
  );

  useRestaurantStaffEntryReconcile(enabled && !skipEntryReconcile, () => {
    void refresh('reconcile');
  });

  useRestaurantRealtimeRefresh(
    supabase,
    restaurant.id,
    `waiter-${restaurant.id}`,
    enabled,
    () => {
      void refresh('signal');
    },
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
    parties,
    partyMembers,
    openTableDefaults,
    supportsBuffetOpenTable,
    refresh,
    applyPartyState,
    applyBoardFromPublished,
    applySessionRelocationPatch,
    supabase,
  };
}
