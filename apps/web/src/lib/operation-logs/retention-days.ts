/** Sole retention-day bounds for query window, date picker, purge, and feature settings. */
export const OPERATION_LOG_RETENTION_DAYS_MIN = 7;
export const OPERATION_LOG_RETENTION_DAYS_MAX = 90;
export const OPERATION_LOG_RETENTION_DAYS_DEFAULT = 7;

/** Normalize stored or patched retention days into the allowed inclusive range. */
export function resolveOperationLogRetentionDays(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return OPERATION_LOG_RETENTION_DAYS_DEFAULT;
  const rounded = Math.round(n);
  return Math.max(
    OPERATION_LOG_RETENTION_DAYS_MIN,
    Math.min(OPERATION_LOG_RETENTION_DAYS_MAX, rounded),
  );
}
