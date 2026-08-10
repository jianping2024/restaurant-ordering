'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  buildDashboardListCacheKey,
  isDashboardListClosedRange,
  readDashboardListCache,
  writeDashboardListCache,
  type DashboardListCacheScope,
} from '@/lib/dashboard-list-query-cache';
import { LIST_DEFAULT_PAGE_SIZE, type ListPageSize } from '@/lib/paginate-list';

export const DASHBOARD_LIST_FILTER_DEBOUNCE_MS = 500;

export type DashboardListQuery<TFilters> = {
  filters: TFilters;
  page: number;
  pageSize: ListPageSize;
};

export type DashboardListFetchResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: string };

export type DashboardListQueryCacheOptions<TFilters> = {
  scope: DashboardListCacheScope;
  restaurantId: string;
  /** Lisbon calendar today (YYYY-MM-DD). */
  today: string;
  /** Range end date from filters for closed-window detection. */
  rangeEndDate: (filters: TFilters) => string;
};

function filtersEqual<TFilters>(a: TFilters, b: TFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function cacheKeyFor<TFilters>(
  cache: DashboardListQueryCacheOptions<TFilters>,
  query: DashboardListQuery<TFilters>,
): string {
  return buildDashboardListCacheKey({
    scope: cache.scope,
    restaurantId: cache.restaurantId,
    filters: query.filters,
    page: query.page,
    pageSize: query.pageSize,
  });
}

function lookupCache<TFilters, TData>(
  cache: DashboardListQueryCacheOptions<TFilters> | undefined,
  query: DashboardListQuery<TFilters>,
): { action: 'miss' } | { action: 'fresh'; data: TData } | { action: 'stale'; data: TData } {
  if (!cache || !cache.restaurantId) return { action: 'miss' };
  const closed = isDashboardListClosedRange(cache.rangeEndDate(query.filters), cache.today);
  return readDashboardListCache<TData>(cacheKeyFor(cache, query), { closed });
}

/**
 * Sole dashboard list query driver: one query snapshot → one abortable fetch.
 * Draft filters debounce into query (reset page); page/size update query immediately.
 * Optional session cache (closed ranges sticky; open ranges short TTL + stale revalidate).
 */
export function useDashboardListQuery<TFilters, TData>(options: {
  initialFilters: TFilters;
  initialPageSize?: ListPageSize;
  debounceMs?: number;
  cache?: DashboardListQueryCacheOptions<TFilters>;
  fetchList: (args: {
    filters: TFilters;
    page: number;
    pageSize: ListPageSize;
    signal: AbortSignal;
  }) => Promise<DashboardListFetchResult<TData>>;
  onFetchError?: (error: string) => void;
  onSuccess?: (data: TData) => void;
}) {
  const {
    initialFilters,
    initialPageSize = LIST_DEFAULT_PAGE_SIZE,
    debounceMs = DASHBOARD_LIST_FILTER_DEBOUNCE_MS,
    cache,
  } = options;

  const initialQuery: DashboardListQuery<TFilters> = {
    filters: initialFilters,
    page: 1,
    pageSize: initialPageSize,
  };
  const initialLookup = lookupCache<TFilters, TData>(cache, initialQuery);

  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [query, setQuery] = useState<DashboardListQuery<TFilters>>(initialQuery);
  const [data, setDataState] = useState<TData | null>(
    initialLookup.action === 'miss' ? null : initialLookup.data,
  );
  const [loading, setLoading] = useState(initialLookup.action !== 'fresh');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchListRef = useRef(options.fetchList);
  const onFetchErrorRef = useRef(options.onFetchError);
  const onSuccessRef = useRef(options.onSuccess);
  const cacheRef = useRef(cache);
  const queryRef = useRef(query);
  fetchListRef.current = options.fetchList;
  onFetchErrorRef.current = options.onFetchError;
  onSuccessRef.current = options.onSuccess;
  cacheRef.current = cache;
  queryRef.current = query;

  const lastRefreshNonceRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery((prev) => {
        if (filtersEqual(prev.filters, draftFilters)) return prev;
        return { ...prev, filters: draftFilters, page: 1 };
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [draftFilters, debounceMs]);

  useEffect(() => {
    const ac = new AbortController();
    const forceNetwork = refreshNonce !== lastRefreshNonceRef.current;
    lastRefreshNonceRef.current = refreshNonce;

    const activeCache = cacheRef.current;
    const decision = forceNetwork
      ? ({ action: 'miss' } as const)
      : lookupCache<TFilters, TData>(activeCache, query);

    if (decision.action === 'fresh') {
      setDataState(decision.data);
      setLoading(false);
      onSuccessRef.current?.(decision.data);
      return () => ac.abort();
    }

    if (decision.action === 'stale') {
      setDataState(decision.data);
      onSuccessRef.current?.(decision.data);
    }

    setLoading(true);
    void (async () => {
      const result = await fetchListRef.current({
        filters: query.filters,
        page: query.page,
        pageSize: query.pageSize,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (!result.ok) {
        if (result.error === 'aborted') return;
        setLoading(false);
        onFetchErrorRef.current?.(result.error);
        return;
      }
      setDataState(result.data);
      if (activeCache?.restaurantId) {
        writeDashboardListCache(cacheKeyFor(activeCache, query), result.data);
      }
      setLoading(false);
      onSuccessRef.current?.(result.data);
    })();
    return () => ac.abort();
  }, [query, refreshNonce]);

  const patchDraftFilters = useCallback((patch: Partial<TFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const replaceDraftFilters = useCallback((next: TFilters) => {
    setDraftFilters(next);
  }, []);

  const setPage = useCallback((page: number) => {
    setQuery((prev) => (prev.page === page ? prev : { ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: ListPageSize) => {
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const refresh = useCallback(() => {
    setRefreshNonce((n) => n + 1);
  }, []);

  /** Updates list state and write-through to the current query cache entry when caching. */
  const setData = useCallback(
    (updater: TData | null | ((prev: TData | null) => TData | null)) => {
      setDataState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const activeCache = cacheRef.current;
        if (next && activeCache?.restaurantId) {
          writeDashboardListCache(cacheKeyFor(activeCache, queryRef.current), next);
        }
        return next;
      });
    },
    [],
  );

  return {
    draftFilters,
    patchDraftFilters,
    replaceDraftFilters,
    query,
    data,
    setData,
    loading,
    setPage,
    setPageSize,
    refresh,
  };
}
