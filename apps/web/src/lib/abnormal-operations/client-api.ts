import type {
  AbnormalOperationRow,
  AbnormalOperationStatus,
  AbnormalOperationType,
  AbnormalRiskLevel,
} from '@/lib/abnormal-operations/types';
import type { AbnormalOperationsListResult } from '@/lib/abnormal-operations/owner-query';

export type AbnormalOperationsListParams = {
  startDate?: string;
  endDate?: string;
  type?: AbnormalOperationType;
  riskLevel?: AbnormalRiskLevel;
  status?: AbnormalOperationStatus;
  tableId?: string;
  operatorId?: string;
  page?: number;
  pageSize?: number;
};

function toQuery(params: AbnormalOperationsListParams): string {
  const search = new URLSearchParams();
  if (params.startDate) search.set('start_date', params.startDate);
  if (params.endDate) search.set('end_date', params.endDate);
  if (params.type) search.set('type', params.type);
  if (params.riskLevel) search.set('risk_level', params.riskLevel);
  if (params.status) search.set('status', params.status);
  if (params.tableId) search.set('table_id', params.tableId);
  if (params.operatorId) search.set('operator_id', params.operatorId);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('page_size', String(params.pageSize));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchAbnormalOperations(
  params: AbnormalOperationsListParams,
): Promise<
  | { ok: true; data: AbnormalOperationsListResult }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`/api/dashboard/abnormal-operations${toQuery(params)}`, {
      credentials: 'include',
    });
    const data = (await res.json().catch(() => ({}))) as AbnormalOperationsListResult & {
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'fetch_failed' };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function patchAbnormalOperationClient(
  id: string,
  body: { status?: AbnormalOperationStatus; owner_note?: string | null },
): Promise<
  | { ok: true; row: AbnormalOperationRow }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`/api/dashboard/abnormal-operations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      row?: AbnormalOperationRow;
      error?: string;
    };
    if (!res.ok || !data.row) {
      return { ok: false, error: data.error || 'patch_failed' };
    }
    return { ok: true, row: data.row };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
