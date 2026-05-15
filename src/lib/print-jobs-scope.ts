/** Guardrails: print_jobs list endpoints must never return cross-tenant rows. */

const FORBIDDEN_SCOPE_PARAMS = new Set([
  'restaurant_id',
  'all',
  'global',
  'tenant_id',
  'owner_id',
]);

export function rejectForbiddenPrintJobsScopeParams(searchParams: URLSearchParams): string | null {
  for (const key of Array.from(searchParams.keys())) {
    const k = key.toLowerCase();
    if (FORBIDDEN_SCOPE_PARAMS.has(k)) {
      return key;
    }
  }
  return null;
}

export function rejectUnexpectedPrintJobsQueryParams(
  searchParams: URLSearchParams,
  allowedKeys: readonly string[],
): string | null {
  const allowed = new Set(allowedKeys.map((k) => k.toLowerCase()));
  for (const key of Array.from(searchParams.keys())) {
    if (!allowed.has(key.toLowerCase())) {
      return key;
    }
  }
  return null;
}

export function filterPrintJobsByRestaurant<T extends { restaurant_id?: string | null }>(
  rows: T[] | null | undefined,
  restaurantId: string,
): T[] {
  if (!rows?.length) return [];
  return rows.filter((row) => row.restaurant_id === restaurantId);
}
