'use client';

import type { Order } from '@/types';
import type {
  RestaurantTableGroup,
  RestaurantTableGroupMember,
} from '@/lib/restaurant-table-groups';
import { compareRestaurantTables, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';

type WaiterBoardResponse = {
  orders?: Order[];
  sessionMetaByTableId?: Record<string, WaiterTableSessionMeta>;
  checkoutRequestedTableIds?: string[];
  checkoutRequestedAtByTableId?: Record<string, string>;
  tables?: RestaurantTableRow[];
  groups?: RestaurantTableGroup[];
  members?: RestaurantTableGroupMember[];
};

type KitchenBoardResponse = {
  orders?: Order[];
  activeTableIds?: string[];
  tables?: RestaurantTableRow[];
};

async function fetchStaffBoard<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('staff_board_fetch_failed');
  return res.json() as Promise<T>;
}

/** Waiter board via authenticated staff API. */
export async function fetchWaiterBoardClient(slug: string) {
  const board = await fetchStaffBoard<WaiterBoardResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/board`,
  );
  return {
    orders: board.orders || [],
    sessionMetaByTableId: board.sessionMetaByTableId ?? {},
    checkoutRequestedTableIds: board.checkoutRequestedTableIds || [],
    checkoutRequestedAtByTableId: board.checkoutRequestedAtByTableId ?? {},
    tables: sortRestaurantTables(board.tables || []),
    groups: board.groups || [],
    members: board.members || [],
  };
}

/** Kitchen active board via authenticated staff API. */
export async function fetchKitchenBoardClient(slug: string) {
  const board = await fetchStaffBoard<KitchenBoardResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/kitchen/board`,
  );
  const tables = sortRestaurantTables(board.tables || []);
  const tableById = new Map(tables.map((t) => [t.id, t]));
  const activeTableIds = [...(board.activeTableIds || [])].sort((a, b) => {
    const ta = tableById.get(a);
    const tb = tableById.get(b);
    if (ta && tb) return compareRestaurantTables(ta, tb);
    return a.localeCompare(b);
  });
  return { orders: board.orders || [], activeTableIds, tableById };
}
