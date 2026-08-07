'use client';

import { useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import {
  WaiterBoardContext,
  type WaiterBoardContextValue,
} from '@/components/dashboard/waiter-board-context';
import type { WaiterBoardData } from '@/lib/staff-board';
import { isDashboardWaiterBoardListPath } from '@/lib/dashboard-top-nav';
import {
  commitAuthoritativeWaiterTablePageModel,
  releaseWaiterBoardTableBridge,
} from '@/lib/waiter-staff-mutation-sync';
import type { WaiterSessionRelocationBoardInput } from '@/lib/waiter-session-relocation-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { resolveWaiterBoardReconcileScope } from '@/lib/waiter-board-live';

type Props = {
  restaurant: { id: string; slug: string };
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

/** Heavy board store + realtime — loaded via next/dynamic from WaiterBoardProvider. */
export function WaiterBoardProviderInner({
  restaurant,
  initialBoard,
  children,
}: Props) {
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
