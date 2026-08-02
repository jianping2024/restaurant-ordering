export type PaginatedList<T> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: T[];
};

/** Shared page-size choices for dashboard list footers (staff, abnormal ops, …). */
export const LIST_PAGE_SIZES = [10, 20] as const;
export type ListPageSize = (typeof LIST_PAGE_SIZES)[number];
export const LIST_DEFAULT_PAGE_SIZE: ListPageSize = 10;

export function isListPageSize(value: number): value is ListPageSize {
  return (LIST_PAGE_SIZES as readonly number[]).includes(value);
}

/** Clamp page into range and slice one page of an in-memory list. */
export function paginateList<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): PaginatedList<T> {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.floor(page)), totalPages);
  const start = (safePage - 1) * size;
  return {
    page: safePage,
    pageSize: size,
    total,
    totalPages,
    rows: items.slice(start, start + size),
  };
}
