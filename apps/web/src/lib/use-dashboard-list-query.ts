'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

function filtersEqual<TFilters>(a: TFilters, b: TFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Sole dashboard list query driver: one query snapshot → one abortable fetch.
 * Draft filters debounce into query (reset page); page/size update query immediately.
 */
export function useDashboardListQuery<TFilters, TData>(options: {
  initialFilters: TFilters;
  initialPageSize?: ListPageSize;
  debounceMs?: number;
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
  } = options;

  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [query, setQuery] = useState<DashboardListQuery<TFilters>>({
    filters: initialFilters,
    page: 1,
    pageSize: initialPageSize,
  });
  const [data, setData] = useState<TData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchListRef = useRef(options.fetchList);
  const onFetchErrorRef = useRef(options.onFetchError);
  const onSuccessRef = useRef(options.onSuccess);
  fetchListRef.current = options.fetchList;
  onFetchErrorRef.current = options.onFetchError;
  onSuccessRef.current = options.onSuccess;

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
      setData(result.data);
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
