import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_MAX_CLOSED_SESSIONS,
  ANALYTICS_QUERY_TIMEOUT_MS,
  type ClosedSessionRow,
  type MenuCategoryRow,
} from '@/lib/analytics/analytics.types';
import { sessionDateKeyFromIso } from '@/lib/lisbon-calendar';
import type { BillSplit, OrderItem, OrderStatus } from '@/types';

const SESSION_ID_CHUNK = 100;

/** Columns sufficient for qualifying + sessionRevenue (no items jsonb). */
export const ORDERS_REVENUE_SELECT = 'id, session_id, status, total_amount';

/** Columns for guest headcount + menu-item aggregation. */
export const ORDERS_ITEMS_SELECT = 'id, session_id, status, items, total_amount';

export type AnalyticsRevenueOrder = {
  id: string;
  session_id?: string | null;
  status: OrderStatus;
  total_amount: number;
};

export type AnalyticsItemOrder = AnalyticsRevenueOrder & {
  items: OrderItem[];
};

export type AnalyticsQueryError = { ok: false; code: 'query_limit_exceeded' | 'query_failed'; message?: string };

export async function withAnalyticsQueryTimeout<T>(
  promise: PromiseLike<T>,
  timeoutMs = ANALYTICS_QUERY_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('analytics_query_timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function chunkIds(ids: string[]): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += SESSION_ID_CHUNK) {
    chunks.push(ids.slice(i, i + SESSION_ID_CHUNK));
  }
  return chunks;
}

/** PostgREST page size; must stay ≤ platform max-rows to avoid silent truncation. */
export const ANALYTICS_FETCH_PAGE_SIZE = 1000;

async function paginateClosedSessionsInWindow<T>(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
  select: string,
  options?: { orderById?: boolean },
): Promise<{ ok: true; rows: T[] } | AnalyticsQueryError> {
  try {
    const rows: T[] = [];
    let from = 0;

    for (;;) {
      const to = from + ANALYTICS_FETCH_PAGE_SIZE - 1;
      let query = admin
        .from('table_sessions')
        .select(select)
        .eq('restaurant_id', restaurantId)
        .eq('status', 'closed')
        .not('closed_at', 'is', null)
        .gte('closed_at', startUtc)
        .lt('closed_at', endExclusiveUtc)
        .order('closed_at', { ascending: true });
      if (options?.orderById) {
        query = query.order('id', { ascending: true });
      }

      const { data, error } = (await withAnalyticsQueryTimeout(query.range(from, to))) as {
        data: T[] | null;
        error: { message: string } | null;
      };

      if (error) {
        return { ok: false, code: 'query_failed', message: error.message };
      }

      const page = (data || []) as T[];
      rows.push(...page);

      if (rows.length > ANALYTICS_MAX_CLOSED_SESSIONS) {
        return { ok: false, code: 'query_limit_exceeded' };
      }
      if (page.length < ANALYTICS_FETCH_PAGE_SIZE) {
        break;
      }
      from += ANALYTICS_FETCH_PAGE_SIZE;
    }

    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'query_failed';
    if (message === 'analytics_query_timeout') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message };
  }
}

export async function fetchClosedSessionsInWindow(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<{ ok: true; sessions: ClosedSessionRow[] } | AnalyticsQueryError> {
  const result = await paginateClosedSessionsInWindow<ClosedSessionRow>(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
    'id, closed_at, closed_reason',
    { orderById: true },
  );
  if (!result.ok) return result;
  return { ok: true, sessions: result.rows };
}

/**
 * Lisbon business dates that have at least one closed session in the UTC window.
 * Hard rule: seal loops must iterate these dates only — never empty calendar days.
 */
export async function fetchDistinctClosedBusinessDates(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<{ ok: true; dates: string[] } | AnalyticsQueryError> {
  const result = await paginateClosedSessionsInWindow<{ closed_at: string | null }>(
    admin,
    restaurantId,
    startUtc,
    endExclusiveUtc,
    'closed_at',
  );
  if (!result.ok) return result;

  const dates = new Set<string>();
  for (const row of result.rows) {
    if (!row.closed_at) continue;
    dates.add(sessionDateKeyFromIso(row.closed_at));
  }
  return { ok: true, dates: Array.from(dates).sort() };
}

async function fetchAllRowsForSessionChunk<T extends { session_id?: string | null }>(
  admin: SupabaseClient,
  table: 'orders' | 'bill_splits',
  restaurantId: string,
  sessionChunk: string[],
  select: string,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + ANALYTICS_FETCH_PAGE_SIZE - 1;
    const { data, error } = (await withAnalyticsQueryTimeout(
      admin
        .from(table)
        .select(select)
        .eq('restaurant_id', restaurantId)
        .in('session_id', sessionChunk)
        .order('id', { ascending: true })
        .range(from, to),
    )) as { data: T[] | null; error: { message: string } | null };
    if (error) {
      throw new Error(error.message);
    }
    const page = (data || []) as unknown as T[];
    rows.push(...page);
    if (page.length < ANALYTICS_FETCH_PAGE_SIZE) {
      break;
    }
    from += ANALYTICS_FETCH_PAGE_SIZE;
  }
  return rows;
}

async function fetchBySessionIds<T extends { session_id?: string | null }>(
  admin: SupabaseClient,
  table: 'orders' | 'bill_splits',
  restaurantId: string,
  sessionIds: string[],
  select: string,
): Promise<{ ok: true; rows: T[] } | AnalyticsQueryError> {
  if (sessionIds.length === 0) return { ok: true, rows: [] };

  try {
    const chunks = chunkIds(sessionIds);
    const chunkResults = await Promise.all(
      chunks.map((chunk) =>
        fetchAllRowsForSessionChunk<T>(admin, table, restaurantId, chunk, select),
      ),
    );
    return { ok: true, rows: chunkResults.flat() };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'query_failed';
    if (message === 'analytics_query_timeout') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message };
  }
}

/** Light orders for revenue / qualifying — never pulls items jsonb. */
export async function fetchRevenueOrdersBySessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
) {
  return fetchBySessionIds<AnalyticsRevenueOrder>(
    admin,
    'orders',
    restaurantId,
    sessionIds,
    ORDERS_REVENUE_SELECT,
  );
}

/** Item-bearing orders for guest counts and menu aggregation. */
export async function fetchItemOrdersBySessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
) {
  return fetchBySessionIds<AnalyticsItemOrder>(
    admin,
    'orders',
    restaurantId,
    sessionIds,
    ORDERS_ITEMS_SELECT,
  );
}

export async function fetchBillSplitsBySessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
) {
  return fetchBySessionIds<BillSplit>(
    admin,
    'bill_splits',
    restaurantId,
    sessionIds,
    'id, session_id, status, result, total_amount, discount_rate',
  );
}

export async function fetchUnpaidForcedCloseSessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();

  try {
    const chunks = chunkIds(sessionIds);
    const forced = new Set<string>();
    for (const chunk of chunks) {
      const { data, error } = (await withAnalyticsQueryTimeout(
        admin
          .from('abnormal_operations')
          .select('session_id')
          .eq('restaurant_id', restaurantId)
          .eq('type', 'UNPAID_TABLE_CLOSED')
          .in('session_id', chunk),
      )) as { data: Array<{ session_id: string | null }> | null; error: { message: string } | null };

      if (error) {
        throw new Error(error.message);
      }

      for (const row of data || []) {
        if (row.session_id) forced.add(row.session_id);
      }
    }
    return forced;
  } catch {
    return new Set();
  }
}

export async function fetchMenuCategoriesByItemIds(
  admin: SupabaseClient,
  restaurantId: string,
  itemIds: string[],
): Promise<Map<string, MenuCategoryRow>> {
  const map = new Map<string, MenuCategoryRow>();
  if (itemIds.length === 0) return map;

  const chunks = chunkIds(itemIds);
  for (const chunk of chunks) {
    const { data } = await admin
      .from('menu_items')
      .select('id, category, category_en, category_zh')
      .eq('restaurant_id', restaurantId)
      .in('id', chunk);

    for (const row of (data || []) as MenuCategoryRow[]) {
      map.set(row.id, row);
    }
  }

  return map;
}

export function groupOrdersBySession<T extends { session_id?: string | null }>(
  orders: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const order of orders) {
    if (!order.session_id) continue;
    const list = map.get(order.session_id) || [];
    list.push(order);
    map.set(order.session_id, list);
  }
  return map;
}

export function groupSplitsBySession(splits: BillSplit[]): Map<string, BillSplit[]> {
  const map = new Map<string, BillSplit[]>();
  for (const split of splits) {
    if (!split.session_id) continue;
    const list = map.get(split.session_id) || [];
    list.push(split);
    map.set(split.session_id, list);
  }
  return map;
}
