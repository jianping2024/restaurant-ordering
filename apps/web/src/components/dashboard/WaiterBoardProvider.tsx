'use client';

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from 'react';
import { useWaiterOrders } from '@/components/waiter/useWaiterOrders';
import type { WaiterBoardData } from '@/lib/staff-board';
import { releaseWaiterBoardTableBridge } from '@/lib/waiter-staff-mutation-sync';

export type WaiterBoardContextValue = ReturnType<typeof useWaiterOrders> & {
  /** Drop optimistic bridge for affected tables, then pull Staff board API. */
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
  const seed = initialBoard ?? emptyBoard();
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
    false,
    seed.openTableDefaults,
  );

  const refresh = store.refresh;

  const refreshAfterTableMutation = useCallback(
    async (tableId: string) => {
      releaseWaiterBoardTableBridge([tableId]);
      await refresh();
    },
    [refresh],
  );

  const value: WaiterBoardContextValue = {
    ...store,
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
