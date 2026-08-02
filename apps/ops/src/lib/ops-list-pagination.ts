/** Default page size for ops restaurant / print lists. */
export const OPS_LIST_PAGE_SIZE = 20;

/** Denser page size for ops audit / license lists. */
export const OPS_LIST_PAGE_SIZE_DENSE = 30;

export function parseOpsListPage(searchParams: { get(name: string): string | null }): number {
  const raw = Number(searchParams.get('page') || '1');
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

export function opsListPageCount(total: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize));
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Build a list URL; skips empty filter values. Always includes `page`. */
export function opsListHref(
  pathname: string,
  page: number,
  filters: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.floor(page) || 1)));
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== '') params.set(key, value);
  }
  return `${pathname}?${params.toString()}`;
}

/** PostgREST when `.range()` starts past the last row. */
export function isOpsListRangeUnsatisfiable(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST103' || /range not satisfiable/i.test(error.message || '');
}

/** Prefer PostgREST details (`only N rows`); else 0. */
export function parseOpsListRangeTotal(error: {
  details?: string | null;
} | null | undefined): number {
  const details = error?.details || '';
  const match = details.match(/only (\d+) rows/i);
  if (!match) return 0;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : 0;
}

/** Empty list payload when range is past the end of the result set. */
export function opsListEmptyPagePayload(
  page: number,
  pageSize: number,
  error: { details?: string | null } | null | undefined,
) {
  return {
    items: [] as [],
    page,
    pageSize,
    total: parseOpsListRangeTotal(error),
  };
}
