import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_MAX_CLOSED_SESSIONS,
  ANALYTICS_QUERY_TIMEOUT_MS,
  type ClosedSessionRow,
} from '@/lib/analytics/analytics.types';
import type { BillSplit, Order } from '@/types';

const SESSION_ID_CHUNK = 100;

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

export async function fetchClosedSessionsInWindow(
  admin: SupabaseClient,
  restaurantId: string,
  startUtc: string,
  endExclusiveUtc: string,
): Promise<{ ok: true; sessions: ClosedSessionRow[] } | AnalyticsQueryError> {
  try {
    const { data, error } = (await withAnalyticsQueryTimeout(
      admin
        .from('table_sessions')
        .select('id, closed_at, closed_reason')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'closed')
        .not('closed_at', 'is', null)
        .gte('closed_at', startUtc)
        .lt('closed_at', endExclusiveUtc),
    )) as { data: ClosedSessionRow[] | null; error: { message: string } | null };

    if (error) {
      return { ok: false, code: 'query_failed', message: error.message };
    }

    const sessions = (data || []) as ClosedSessionRow[];
    if (sessions.length > ANALYTICS_MAX_CLOSED_SESSIONS) {
      return { ok: false, code: 'query_limit_exceeded' };
    }

    return { ok: true, sessions };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'query_failed';
    if (message === 'analytics_query_timeout') {
      return { ok: false, code: 'query_limit_exceeded' };
    }
    return { ok: false, code: 'query_failed', message };
  }
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
      chunks.map(async (chunk) => {
        const { data, error } = (await withAnalyticsQueryTimeout(
          admin.from(table).select(select).eq('restaurant_id', restaurantId).in('session_id', chunk),
        )) as { data: T[] | null; error: { message: string } | null };
        if (error) {
          throw new Error(error.message);
        }
        return (data || []) as unknown as T[];
      }),
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

export async function fetchOrdersBySessionIds(
  admin: SupabaseClient,
  restaurantId: string,
  sessionIds: string[],
) {
  return fetchBySessionIds<Order>(
    admin,
    'orders',
    restaurantId,
    sessionIds,
    'id, session_id, status, items, total_amount',
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

import type { MenuCategoryRow } from '@/lib/analytics/analytics.types';

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

export function groupOrdersBySession(orders: Order[]): Map<string, Order[]> {
  const map = new Map<string, Order[]>();
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
