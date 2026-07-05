'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { orderHistoryFiltersToSearchParams } from '@/lib/order-history/parse-query';
import {
  ORDER_HISTORY_PAGE_SIZE,
  type OrderHistoryEntry,
  type OrderHistoryFilters,
  type OrderHistoryPageResult,
} from '@/lib/order-history/types';

type FeedState = OrderHistoryPageResult & {
  filters: OrderHistoryFilters;
};

const FILTER_DEBOUNCE_MS = 300;

async function fetchOrderHistoryPage(
  offset: number,
  limit: number,
  filters: OrderHistoryFilters,
): Promise<OrderHistoryPageResult | null> {
  const params = orderHistoryFiltersToSearchParams(offset, limit, filters);
  const response = await fetch(`/api/dashboard/order-history?${params.toString()}`);
  if (!response.ok) return null;
  return (await response.json()) as OrderHistoryPageResult;
}

export function useOrderHistoryFeed(initial: FeedState) {
  const [entries, setEntries] = useState<OrderHistoryEntry[]>(initial.items);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [cappedTotal, setCappedTotal] = useState(initial.cappedTotal);
  const [filters, setFilters] = useState<OrderHistoryFilters>(initial.filters);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(async (nextFilters: OrderHistoryFilters) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const result = await fetchOrderHistoryPage(0, ORDER_HISTORY_PAGE_SIZE, nextFilters);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result) return;
    setEntries(result.items);
    setHasMore(result.hasMore);
    setCappedTotal(result.cappedTotal);
    setFilters(nextFilters);
  }, []);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const result = await fetchOrderHistoryPage(entries.length, ORDER_HISTORY_PAGE_SIZE, filters);
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result) return;

    setEntries((prev) => {
      const seen = new Set(prev.map((entry) => entry.sessionId));
      const merged = [...prev];
      for (const item of result.items) {
        if (seen.has(item.sessionId)) continue;
        merged.push(item);
        seen.add(item.sessionId);
      }
      return merged;
    });
    setHasMore(result.hasMore);
    setCappedTotal(result.cappedTotal);
  }, [entries.length, filters, hasMore, loading]);

  return {
    entries,
    hasMore,
    cappedTotal,
    filters,
    loading,
    setFilters,
    reload,
    loadMore,
  };
}

export function useDebouncedOrderHistoryFilters(
  filters: OrderHistoryFilters,
  reload: (filters: OrderHistoryFilters) => Promise<void>,
) {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void reload(filters);
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters, reload]);
}
