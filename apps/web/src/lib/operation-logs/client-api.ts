import type { OperationLogActionType } from '@/lib/audit/types';
import type { OperationLogsListResult } from '@/lib/operation-logs/query';

export type OperationLogsListParams = {
  startDate?: string;
  endDate?: string;
  actionType?: OperationLogActionType;
  page?: number;
  pageSize?: number;
};

function toQuery(params: OperationLogsListParams): string {
  const search = new URLSearchParams();
  if (params.startDate) search.set('start_date', params.startDate);
  if (params.endDate) search.set('end_date', params.endDate);
  if (params.actionType) search.set('action_type', params.actionType);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('page_size', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchOperationLogs(
  params: OperationLogsListParams,
  init?: { signal?: AbortSignal },
): Promise<{ ok: true; data: OperationLogsListResult } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/dashboard/operation-logs${toQuery(params)}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: init?.signal,
    });
    const data = (await res.json().catch(() => ({}))) as OperationLogsListResult & {
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'fetch_failed' };
    }
    return { ok: true, data };
  } catch (err) {
    if (init?.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
      return { ok: false, error: 'aborted' };
    }
    return { ok: false, error: 'network_error' };
  }
}
