'use client';

import { createContext, useContext } from 'react';
import type { WaiterSessionRelocationBoardInput } from '@/lib/waiter-session-relocation-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';

type WaiterOrdersStore = ReturnType<
  typeof import('@/components/waiter/useWaiterOrders').useWaiterOrders
>;

export type WaiterBoardContextValue = WaiterOrdersStore & {
  /** Drop optimistic bridge for affected tables, then pull Staff board API. */
  refreshBoardAfterStaffMutation: (tableIds: readonly string[]) => Promise<void>;
  /** Patch board from relocation model, clear source bridge only, refresh in background. */
  reconcileBoardAfterSessionRelocation: (input: WaiterSessionRelocationBoardInput) => void;
  /** Apply POST open-table model to board read-model without a board refresh. */
  applyOpenTableToBoard: (model: WaiterTablePageModel) => void;
};

export const WaiterBoardContext = createContext<WaiterBoardContextValue | null>(null);

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
