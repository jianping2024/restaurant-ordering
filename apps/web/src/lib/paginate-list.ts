export type PaginatedList<T> = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  rows: T[];
};

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
