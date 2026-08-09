import {
  defaultOrderHistoryClosedRange,
  parseOrderHistoryClosedRange,
  type OrderHistoryClosedRange,
} from '@/lib/order-history/date-range';
import type { OrderHistoryFilters } from '@/lib/order-history/types';
import {
  isListPageSize,
  LIST_DEFAULT_PAGE_SIZE,
  type ListPageSize,
} from '@/lib/paginate-list';

export type ParsedOrderHistorySearchParams =
  | {
      ok: true;
      offset: number;
      limit: number;
      filters: OrderHistoryFilters;
    }
  | { ok: false; code: 'invalid_date_range' };

export function parseOrderHistorySearchParams(
  searchParams: URLSearchParams,
): ParsedOrderHistorySearchParams {
  const offset = Math.max(0, Number(searchParams.get('offset') || 0) || 0);
  const limitRaw = Number(searchParams.get('limit') || LIST_DEFAULT_PAGE_SIZE) || LIST_DEFAULT_PAGE_SIZE;

  const tableIds = (searchParams.get('tableIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const sessionId = searchParams.get('sessionId')?.trim() || undefined;
  const closedFromRaw = searchParams.get('closedFrom')?.trim() || undefined;
  const closedToRaw = searchParams.get('closedTo')?.trim() || undefined;

  if (sessionId) {
    return {
      ok: true,
      offset,
      limit: Math.max(1, Math.min(20, Number.isFinite(limitRaw) ? limitRaw : 1)),
      filters: {
        tableIds,
        sessionId,
        closedFrom: closedFromRaw,
        closedTo: closedToRaw,
      },
    };
  }

  const limit: ListPageSize = isListPageSize(limitRaw) ? limitRaw : LIST_DEFAULT_PAGE_SIZE;

  const parsedRange = parseOrderHistoryClosedRange({
    closedFrom: closedFromRaw,
    closedTo: closedToRaw,
    applyDefaultWhenMissing: true,
  });
  if (!parsedRange.ok) {
    return { ok: false, code: 'invalid_date_range' };
  }

  return {
    ok: true,
    offset,
    limit,
    filters: {
      tableIds,
      closedFrom: parsedRange.range.closedFrom,
      closedTo: parsedRange.range.closedTo,
    },
  };
}

export function orderHistoryFiltersToSearchParams(
  offset: number,
  limit: number,
  filters: OrderHistoryFilters,
): URLSearchParams {
  const params = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });
  if (filters.tableIds.length > 0) {
    params.set('tableIds', filters.tableIds.join(','));
  }
  if (filters.closedFrom) params.set('closedFrom', filters.closedFrom);
  if (filters.closedTo) params.set('closedTo', filters.closedTo);
  if (filters.sessionId) params.set('sessionId', filters.sessionId);
  return params;
}

export function resolveListFiltersOrDefault(
  filters: Pick<OrderHistoryFilters, 'tableIds' | 'closedFrom' | 'closedTo'> = {
    tableIds: [],
  },
): OrderHistoryFilters & OrderHistoryClosedRange {
  const parsed = parseOrderHistoryClosedRange({
    closedFrom: filters.closedFrom,
    closedTo: filters.closedTo,
    applyDefaultWhenMissing: true,
  });
  const range = parsed.ok ? parsed.range : defaultOrderHistoryClosedRange();
  return {
    tableIds: filters.tableIds,
    closedFrom: range.closedFrom,
    closedTo: range.closedTo,
  };
}
