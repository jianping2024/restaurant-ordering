'use client';

import {
  createContext,
  useCallback,
  useContext,
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
import { resolveWaiterBoardReconcileScope } from '@/lib/waiter-board-live';

export type WaiterBoardContextValue = ReturnType<typeof useWaiterOrders> & {
  /** Drop optimistic bridge for affected tables, then pull Staff board API. */
  refreshBoardAfterStaffMutation: (tableIds: readonly string[]) => Promise<void>;
  /** Patch board from relocation model, clear source bridge only, refresh in background. */
  reconcileBoardAfterSessionRelocation: (input: WaiterSessionRelocationBoardInput) => void;
  /** Apply POST open-table model to board read-model without a board refresh. */
  applyOpenTableToBoard: (model: WaiterTablePageModel) => void;
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
  /** Optional SSR/demo seed — Dashboard chrome passes none; floor hydrates on list surface. */
  initialBoard?: WaiterBoardData | null;
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
  /** Same scope rule as list entry/visibility — live when floor ready, else full. */
  const mutationRefreshScope = resolveWaiterBoardReconcileScope(store.boardSurface === 'ready');

  const refreshBoardAfterStaffMutation = useCallback(
    async (tableIds: readonly string[]) => {
      if (tableIds.length === 0) return;
      releaseWaiterBoardTableBridge(tableIds);
      await refresh(mutationRefreshScope);
    },
    [mutationRefreshScope, refresh],
  );

  const reconcileBoardAfterSessionRelocation = useCallback(
    (input: WaiterSessionRelocationBoardInput) => {
      store.applySessionRelocationPatch(input);
      releaseWaiterBoardTableBridge([input.sourceTableId]);
      void refresh(mutationRefreshScope);
    },
    [mutationRefreshScope, refresh, store],
  );

  const applyOpenTableToBoard = useCallback(
    (model: WaiterTablePageModel) => {
      commitAuthoritativeWaiterTablePageModel(model);
      store.applyBoardFromPublished();
    },
    [store],
  );

  const value: WaiterBoardContextValue = {
    ...store,
    refreshBoardAfterStaffMutation,
    reconcileBoardAfterSessionRelocation,
    applyOpenTableToBoard,
  };

  return (
    <WaiterBoardContext.Provider value={value}>{children}</WaiterBoardContext.Provider>
  );
}

export function WaiterBoardProvider({ restaurant, enabled, initialBoard = null, children }: Props) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <WaiterBoardProviderInner restaurant={restaurant} initialBoard={initialBoard}>
      {children}
    </WaiterBoardProviderInner>
  );
}
