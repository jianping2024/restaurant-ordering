'use client';

import { compareRestaurantTables, sortRestaurantTables, type RestaurantTableRow } from '@/lib/restaurant-tables';
import type { WaiterBoardData } from '@/lib/staff-board';
import type { WaiterTablePageModel } from '@/lib/waiter-table-detail-types';
import { normalizeWaiterTablePageModel } from '@/lib/waiter-table-detail-normalize';
import {
  type WaiterBoardFetchScope,
  type WaiterBoardLivePatch,
} from '@/lib/waiter-board-live';
import { fetchWithDependencyTimeout } from '@/lib/dependency-unavailable';
import type { Order } from '@/types';

export type WaiterBoardClientResult =
  | { status: 'ok'; scope: 'full'; board: WaiterBoardData }
  | { status: 'ok'; scope: 'live'; live: WaiterBoardLivePatch };

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
    parties: board.parties || [],
    partyMembers: board.partyMembers || [],
    tableSummaries: board.tableSummaries || [],
    restaurantHasActiveBuffets: board.restaurantHasActiveBuffets ?? false,
    openTableDefaults: board.openTableDefaults ?? null,
  };
}

function normalizeWaiterBoardLivePatch(live: WaiterBoardLivePatch): WaiterBoardLivePatch {
  return {
    sessionMetaByTableId: live.sessionMetaByTableId ?? {},
    checkoutRequestedTableIds: live.checkoutRequestedTableIds || [],
    checkoutRequestedAtByTableId: live.checkoutRequestedAtByTableId ?? {},
    parties: live.parties || [],
    partyMembers: live.partyMembers || [],
    tableSummaries: live.tableSummaries || [],
  };
}

/** Waiter board via authenticated staff API — full or live scope. */
export async function fetchWaiterBoardClient(
  slug: string,
  scope: WaiterBoardFetchScope = 'full',
): Promise<WaiterBoardClientResult> {
  const url = new URL(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/board`,
    window.location.origin,
  );
  if (scope === 'live') url.searchParams.set('scope', 'live');

  const res = await fetch(url.toString(), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('staff_board_fetch_failed');
  const data = (await res.json()) as
    | { scope?: 'full'; board?: WaiterBoardData }
    | { scope?: 'live'; live?: WaiterBoardLivePatch };

  if (data.scope === 'live' && data.live) {
    return { status: 'ok', scope: 'live', live: normalizeWaiterBoardLivePatch(data.live) };
  }
  if (data.scope === 'full' && data.board) {
    return { status: 'ok', scope: 'full', board: normalizeWaiterBoard(data.board) };
  }
  throw new Error('staff_board_unexpected_body');
}

/** Single-table waiter page model via authenticated staff API. */
export async function fetchWaiterTablePageModelClient(
  slug: string,
  tableId: string,
  scope: 'full' | 'live' = 'full',
): Promise<WaiterTablePageModel> {
  const url = new URL(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/tables/${encodeURIComponent(tableId)}`,
    window.location.origin,
  );
  if (scope === 'live') url.searchParams.set('scope', 'live');
  const model = await fetchStaffBoard<WaiterTablePageModel>(url.toString());
  return normalizeWaiterTablePageModel(model);
}

type WaiterBuffetOpenResponse = {
  ok?: boolean;
  model?: WaiterTablePageModel;
  detail?: WaiterTablePageModel['detail'];
  error?: string;
  code?: string;
};

/** Open table (buffet); returns refreshed page model when successful. */
export async function postWaiterBuffetOpenClient(
  slug: string,
  body: {
    table_id: string;
    buffets: Array<{
      buffet_id: string;
      adult_count: number;
      child_count: number;
    }>;
  },
): Promise<WaiterTablePageModel> {
  const res = await fetchWithDependencyTimeout(
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
    err.code = data.code ?? data.error;
    throw err;
  }
  if (data.model) return normalizeWaiterTablePageModel(data.model);
  if (data.detail) {
    return normalizeWaiterTablePageModel({
      detail: data.detail,
      buffets: [],
      buffetPricesByBuffetId: {},
      inTableParty: false,
    });
  }
  throw new Error('buffet_open_missing_model');
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

type WaiterTableActionResponse = {
  ok?: boolean;
  session_id?: string;
  model?: WaiterTablePageModel;
  error?: string;
};

/** Transfer or merge table sessions; returns authoritative target page model. */
export async function postWaiterTableActionClient(
  slug: string,
  body: {
    action: 'transfer' | 'merge';
    from_table_id: string;
    to_table_id: string;
  },
): Promise<{ session_id: string; model: WaiterTablePageModel }> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/tables/action`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as WaiterTableActionResponse;
  if (!res.ok) {
    const err = new Error(data.error || 'staff_table_action_failed') as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  if (!data.model || !data.session_id) {
    throw new Error('staff_table_action_missing_model');
  }
  return {
    session_id: data.session_id,
    model: normalizeWaiterTablePageModel(data.model),
  };
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
