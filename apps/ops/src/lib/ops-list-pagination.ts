/** Allowed page sizes for ops list footers (default 20). */
export const OPS_LIST_PAGE_SIZES = [10, 20] as const;
export type OpsListPageSize = (typeof OPS_LIST_PAGE_SIZES)[number];
export const OPS_LIST_DEFAULT_PAGE_SIZE: OpsListPageSize = 20;

export function isOpsListPageSize(value: number): value is OpsListPageSize {
  return (OPS_LIST_PAGE_SIZES as readonly number[]).includes(value);
}

export function parseOpsListPage(searchParams: { get(name: string): string | null }): number {
  const raw = Number(searchParams.get('page') || '1');
  if (!Number.isFinite(raw)) return 1;
  return Math.max(1, Math.floor(raw));
}

export function parseOpsListPageSize(searchParams: {
  get(name: string): string | null;
}): OpsListPageSize {
  const raw = Number(searchParams.get('pageSize') || '');
  if (isOpsListPageSize(raw)) return raw;
  return OPS_LIST_DEFAULT_PAGE_SIZE;
}

export function opsListPageCount(total: number, pageSize: number): number {
  const size = Math.max(1, Math.floor(pageSize));
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/**
 * Build a list URL. Always includes `page`.
 * Includes `pageSize` only when it differs from the default (20).
 */
export function opsListHref(
  pathname: string,
  page: number,
  filters: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.floor(page) || 1)));
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    if (key === 'pageSize' && Number(value) === OPS_LIST_DEFAULT_PAGE_SIZE) continue;
    params.set(key, value);
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
