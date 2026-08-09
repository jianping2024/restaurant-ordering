'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { orderHistoryFiltersToSearchParams } from '@/lib/order-history/parse-query';
import type {
  OrderHistoryEntry,
  OrderHistoryFilters,
  OrderHistoryPageResult,
} from '@/lib/order-history/types';
import {
  type ListPageSize,
} from '@/lib/paginate-list';

type FeedState = {
  items: OrderHistoryEntry[];
  total: number;
  itemCodeByMenuId: Record<string, string>;
  filters: OrderHistoryFilters;
  page: number;
  pageSize: ListPageSize;
};

const FILTER_DEBOUNCE_MS = 300;

export async function fetchOrderHistoryPage(
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
  const [total, setTotal] = useState(initial.total);
  const [itemCodeByMenuId, setItemCodeByMenuId] = useState(initial.itemCodeByMenuId);
  const [filters, setFilters] = useState<OrderHistoryFilters>(initial.filters);
  const [page, setPage] = useState(initial.page);
  const [pageSize, setPageSize] = useState<ListPageSize>(initial.pageSize);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);
  const skipFilterReloadRef = useRef(true);

  const loadPage = useCallback(
    async (next: {
      page: number;
      pageSize: ListPageSize;
      filters: OrderHistoryFilters;
    }) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      const offset = (next.page - 1) * next.pageSize;
      const result = await fetchOrderHistoryPage(offset, next.pageSize, next.filters);
      if (requestId !== requestIdRef.current) return;
      setLoading(false);
      if (!result) return;
      setEntries(result.items);
      setTotal(result.total);
      setItemCodeByMenuId(result.itemCodeByMenuId);
      setFilters(next.filters);
      setPage(next.page);
      setPageSize(next.pageSize);
    },
    [],
  );

  const reloadFromFilters = useCallback(
    async (nextFilters: OrderHistoryFilters) => {
      await loadPage({ page: 1, pageSize, filters: nextFilters });
    },
    [loadPage, pageSize],
  );

  useEffect(() => {
    if (skipFilterReloadRef.current) {
      skipFilterReloadRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void reloadFromFilters(filters);
    }, FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [filters, reloadFromFilters]);

  const goToPage = useCallback(
    (nextPage: number) => {
      void loadPage({ page: nextPage, pageSize, filters });
    },
    [filters, loadPage, pageSize],
  );

  const changePageSize = useCallback(
    (nextSize: ListPageSize) => {
      void loadPage({ page: 1, pageSize: nextSize, filters });
    },
    [filters, loadPage],
  );

  return {
    entries,
    total,
    itemCodeByMenuId,
    filters,
    page,
    pageSize,
    loading,
    setFilters,
    goToPage,
    changePageSize,
  };
}
