'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import type { WaiterBoardData } from '@/lib/staff-board';
import { isDashboardWaiterBoardListPath } from '@/lib/dashboard-top-nav';
import {
  commitAuthoritativeWaiterTablePageModel,
  releaseWaiterBoardTableBridge,
} from '@/lib/waiter-staff-mutation-sync';
import type { WaiterSessionRelocationBoardInput } from '@/lib/waiter-session-relocation-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

export type WaiterBoardContextValue = ReturnType<typeof useWaiterOrders> & {
  /** Drop optimistic bridge for affected tables, then pull Staff board API. */
  refreshBoardAfterStaffMutation: (tableIds: readonly string[]) => Promise<void>;
  /** Patch board from relocation model, clear source bridge only, refresh in background. */
  reconcileBoardAfterSessionRelocation: (input: WaiterSessionRelocationBoardInput) => void;
  /** Apply POST open-table model to board read-model without a board refresh. */
  applyOpenTableToBoard: (model: WaiterTablePageModel) => void;
  /** @deprecated Prefer refreshBoardAfterStaffMutation */
  refreshAfterTableMutation: (tableId: string) => Promise<void>;
};

const WaiterBoardContext = createContext<WaiterBoardContextValue | null>(null);

export function useWaiterBoardOptional(): WaiterBoardContextValue | null {
  return useContext(WaiterBoardContext);
}

export function useWaiterBoard(): WaiterBoardContextValue {
  const ctx = useContext(WaiterBoardContext);
  if (!ctx) {
    throw new Error('useWaiterBoard must be used within WaiterBoardProvider');
  }
  return ctx;
}

type Props = {
  restaurant: { id: string; slug: string };
  enabled: boolean;
  initialBoard: WaiterBoardData | null;
  children: ReactNode;
};

function emptyBoard(): WaiterBoardData {
  return {
    sessionMetaByTableId: {},
    checkoutRequestedTableIds: [],
    checkoutRequestedAtByTableId: {},
    tables: [],
    groups: [],
    members: [],
    parties: [],
    partyMembers: [],
    tableSummaries: [],
    restaurantHasActiveBuffets: false,
    openTableDefaults: null,
  };
}

function WaiterBoardProviderInner({
  restaurant,
  initialBoard,
  children,
}: Omit<Props, 'enabled'>) {
  const pathname = usePathname();
  const boardListVisible = isDashboardWaiterBoardListPath(pathname);
  const wasBoardListVisibleRef = useRef(boardListVisible);

  const seed = initialBoard ?? emptyBoard();
  const hasAuthoritativeSeed = initialBoard != null;
  const store = useWaiterOrders(
    restaurant,
    seed.tableSummaries,
    seed.checkoutRequestedTableIds,
    seed.tables,
    true,
    seed.sessionMetaByTableId,
    seed.checkoutRequestedAtByTableId,
    seed.groups,
    seed.members,
    [],
    hasAuthoritativeSeed,
    seed.openTableDefaults,
    seed.parties,
    seed.partyMembers,
    boardListVisible,
  );

  const refresh = store.refresh;

  // Detail → board list: one authoritative full pull. Do not run when leaving the list.
  useEffect(() => {
    const wasVisible = wasBoardListVisibleRef.current;
    wasBoardListVisibleRef.current = boardListVisible;
    if (boardListVisible && !wasVisible) {
      void refresh('full');
    }
  }, [boardListVisible, refresh]);

  const refreshBoardAfterStaffMutation = useCallback(
    async (tableIds: readonly string[]) => {
      if (tableIds.length === 0) return;
      releaseWaiterBoardTableBridge(tableIds);
      await refresh('full');
    },
    [refresh],
  );

  const reconcileBoardAfterSessionRelocation = useCallback(
    (input: WaiterSessionRelocationBoardInput) => {
      store.applySessionRelocationPatch(input);
      releaseWaiterBoardTableBridge([input.sourceTableId]);
      void refresh('full');
    },
    [refresh, store],
  );

  const applyOpenTableToBoard = useCallback(
    (model: WaiterTablePageModel) => {
      commitAuthoritativeWaiterTablePageModel(model);
      store.applyBoardFromPublished();
    },
    [store],
  );

  const refreshAfterTableMutation = useCallback(
    async (tableId: string) => {
      await refreshBoardAfterStaffMutation([tableId]);
    },
    [refreshBoardAfterStaffMutation],
  );

  const value: WaiterBoardContextValue = {
    ...store,
    refreshBoardAfterStaffMutation,
    reconcileBoardAfterSessionRelocation,
    applyOpenTableToBoard,
    refreshAfterTableMutation,
  };

  return (
    <WaiterBoardContext.Provider value={value}>{children}</WaiterBoardContext.Provider>
  );
}

export function WaiterBoardProvider({ restaurant, enabled, initialBoard, children }: Props) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <WaiterBoardProviderInner restaurant={restaurant} initialBoard={initialBoard}>
      {children}
    </WaiterBoardProviderInner>
  );
}
