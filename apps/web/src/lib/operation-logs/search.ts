/**
 * Sole operation-logs list search (`q`):
 * `operator_name` OR `after_data->>tableName` (ilike).
 */

/** Sole table-side JSON path for list `q` (matches most 桌位 cells). */
export const OPERATION_LOG_Q_TABLE_JSON_PATH = 'after_data->>tableName' as const;

export const OPERATION_LOGS_Q_MAX_LEN = 64;

/** Trim + length cap; empty → undefined (no filter). Sole normalizer for list `q`. */
export function normalizeOperationLogsSearchQ(raw: string | undefined | null): string | undefined {
  if (raw == null) return undefined;
  const trimmed = raw.trim().slice(0, OPERATION_LOGS_Q_MAX_LEN);
  return trimmed || undefined;
}

/** Escape LIKE wildcards; strip chars that break PostgREST `.or()` value parsing. */
export function escapeIlikePatternForOr(raw: string): string {
  return raw.replace(/[%_\\]/g, '\\$&').replace(/[",]/g, '');
}

/** PostgREST `.or()` filter for non-empty `q`. */
export function operationLogsSearchOrFilter(q: string): string {
  const escaped = escapeIlikePatternForOr(q);
  const pattern = `%${escaped}%`;
  return `operator_name.ilike.${pattern},${OPERATION_LOG_Q_TABLE_JSON_PATH}.ilike.${pattern}`;
}
