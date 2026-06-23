export const DEFAULT_ORDER_RADIUS_METERS = 50;
export const MIN_ORDER_RADIUS_METERS = 10;
export const MAX_ORDER_RADIUS_METERS = 10_000;

export function normalizeOrderRadiusMeters(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_ORDER_RADIUS_METERS;
  return Math.round(Math.max(MIN_ORDER_RADIUS_METERS, Math.min(MAX_ORDER_RADIUS_METERS, n)));
}

/** Parse owner settings form value; null = invalid. */
export function parseOrderRadiusInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_ORDER_RADIUS_METERS;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < MIN_ORDER_RADIUS_METERS || n > MAX_ORDER_RADIUS_METERS) {
    return null;
  }
  return n;
}
