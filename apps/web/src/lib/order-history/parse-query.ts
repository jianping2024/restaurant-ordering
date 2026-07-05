import type { OrderHistoryFilters } from '@/lib/order-history/types';

export function parseOrderHistorySearchParams(
  searchParams: URLSearchParams,
): {
  offset: number;
  limit: number;
  filters: OrderHistoryFilters;
} {
  const offset = Math.max(0, Number(searchParams.get('offset') || 0) || 0);
  const limit = Math.max(1, Math.min(20, Number(searchParams.get('limit') || 10) || 10));

  const tableIds = (searchParams.get('tableIds') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const closedFrom = searchParams.get('closedFrom')?.trim() || undefined;
  const closedTo = searchParams.get('closedTo')?.trim() || undefined;

  return {
    offset,
    limit,
    filters: { tableIds, closedFrom, closedTo },
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
  return params;
}

export function formatDateRangeFilter(range: { from?: Date; to?: Date }): Pick<
  OrderHistoryFilters,
  'closedFrom' | 'closedTo'
> {
  const closedFrom = range.from ? formatDateKey(range.from) : undefined;
  const closedTo = range.to
    ? formatDateKey(range.to)
    : range.from
      ? formatDateKey(range.from)
      : undefined;
  return { closedFrom, closedTo };
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
