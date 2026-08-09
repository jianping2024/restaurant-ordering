/** Shared by kitchen + waiter board refresh failure handling. */
export type StaffBoardFetchFailureKind = 'unauthorized' | 'failed';

/** Only HTTP 401 is session-exit; 403/429/5xx/network stay retryable failed. */
export function classifyStaffBoardFetchFailure(err: unknown): StaffBoardFetchFailureKind {
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? Number((err as { status?: unknown }).status)
      : NaN;
  if (status === 401) return 'unauthorized';
  return 'failed';
}
