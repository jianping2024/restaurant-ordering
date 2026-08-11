/** Shared by kitchen + waiter board refresh / kitchen prep failure handling. */
export type StaffBoardFetchFailureKind = 'unauthorized' | 'failed';

/**
 * Only HTTP 401 is session-exit; 403/429/5xx/network stay retryable failed.
 * Accepts a bare status number or an Error/{ status } from staff board clients.
 */
export function classifyStaffBoardFetchFailure(err: unknown): StaffBoardFetchFailureKind {
  const status =
    typeof err === 'number'
      ? err
      : typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : NaN;
  if (status === 401) return 'unauthorized';
  return 'failed';
}
