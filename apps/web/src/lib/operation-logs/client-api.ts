import type { OperationLogActionType } from '@/lib/audit/types';
import type { OperationLogsListResult } from '@/lib/operation-logs/query';

export type OperationLogsListParams = {
  date?: string;
  actionType?: OperationLogActionType;
  q?: string;
  page?: number;
  pageSize?: number;
};

function toQuery(params: OperationLogsListParams): string {
  const search = new URLSearchParams();
  if (params.date) search.set('date', params.date);
  if (params.actionType) search.set('action_type', params.actionType);
  if (params.q) search.set('q', params.q);
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
