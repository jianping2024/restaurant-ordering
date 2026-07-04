'use client';

import { compareRestaurantTables, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterBoardData, WaiterTableDetailData } from '@/lib/staff-board';
import type { WaiterTableSessionMeta } from '@/lib/waiter-board-session';
import type { WaiterBoardTableSummary } from '@/lib/waiter-board-snapshot';
import type { Order } from '@/types';

async function fetchStaffBoard<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('staff_board_fetch_failed');
  return res.json() as Promise<T>;
}

function normalizeWaiterBoard(board: WaiterBoardData): WaiterBoardData {
  return {
    sessionMetaByTableId: board.sessionMetaByTableId ?? {},
    checkoutRequestedTableIds: board.checkoutRequestedTableIds || [],
    checkoutRequestedAtByTableId: board.checkoutRequestedAtByTableId ?? {},
    tables: sortRestaurantTables(board.tables || []),
    groups: board.groups || [],
    members: board.members || [],
    tableSummaries: board.tableSummaries || [],
  };
}

/** Waiter board via authenticated staff API. */
export async function fetchWaiterBoardClient(slug: string): Promise<WaiterBoardData> {
  const board = await fetchStaffBoard<WaiterBoardData>(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/board`,
  );
  return normalizeWaiterBoard(board);
}

export type { WaiterBoardTableSummary, WaiterTableSessionMeta };

/** Single-table waiter detail via authenticated staff API. */
export async function fetchWaiterTableDetailClient(
  slug: string,
  tableId: string,
): Promise<WaiterTableDetailData> {
  const detail = await fetchStaffBoard<WaiterTableDetailData>(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/tables/${encodeURIComponent(tableId)}`,
  );
  return normalizeWaiterTableDetail(detail);
}

function normalizeWaiterTableDetail(detail: WaiterTableDetailData): WaiterTableDetailData {
  return {
    table: detail.table ?? null,
    sessionMeta: detail.sessionMeta ?? null,
    orders: detail.orders || [],
    checkoutRequested: !!detail.checkoutRequested,
    checkoutRequestedAt: detail.checkoutRequestedAt ?? null,
  };
}

type WaiterBuffetOpenResponse = {
  ok?: boolean;
  detail?: WaiterTableDetailData;
  error?: string;
};

/** Open table (buffet); returns refreshed table detail when successful. */
export async function postWaiterBuffetOpenClient(
  slug: string,
  body: {
    table_id: string;
    buffet_id: string;
    adult_count: number;
    child_count: number;
  },
): Promise<WaiterTableDetailData> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/buffet`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as WaiterBuffetOpenResponse;
  if (!res.ok) {
    const err = new Error(data.error || 'buffet_open_failed') as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  if (!data.detail) {
    throw new Error('buffet_open_missing_detail');
  }
  return normalizeWaiterTableDetail(data.detail);
}

/** Transfer/merge target tables for one source table. */
export async function fetchWaiterTableActionTargetsClient(
  slug: string,
  tableId: string,
  operation: 'transfer' | 'merge',
): Promise<RestaurantTableRow[]> {
  const url = new URL(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/tables/${encodeURIComponent(tableId)}/action-targets`,
    window.location.origin,
  );
  url.searchParams.set('operation', operation);
  const res = await fetch(url.toString(), { credentials: 'include' });
  if (!res.ok) throw new Error('staff_table_targets_fetch_failed');
  const data = (await res.json()) as { tables?: RestaurantTableRow[] };
  return sortRestaurantTables(data.tables || []);
}

type KitchenBoardResponse = {
  orders?: Order[];
  activeTableIds?: string[];
  tables?: RestaurantTableRow[];
};

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
