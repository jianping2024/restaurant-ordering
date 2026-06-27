import type { RestaurantTableGroup, RestaurantTableGroupMember } from '@/lib/restaurant-table-groups';

type ApiError = { error: string; message?: string };

async function parseJson<T>(res: Response): Promise<T & ApiError> {
  return (await res.json().catch(() => ({}))) as T & ApiError;
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; message?: string }> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    const data = await parseJson<T>(res);
    if (!res.ok) {
      return { ok: false, error: data.error || 'request_failed', message: data.message };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export type TableGroupsResponse = {
  groups: RestaurantTableGroup[];
  members: RestaurantTableGroupMember[];
};

export async function createTableGroupClient(input: {
  name: string;
  remarks?: string | null;
  table_ids?: string[];
}) {
  return request<TableGroupsResponse>('/api/dashboard/table-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateTableGroupClient(input: {
  group_id: string;
  name: string;
  remarks?: string | null;
  table_ids?: string[];
}) {
  return request<TableGroupsResponse>('/api/dashboard/table-groups', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function swapTableGroupOrderClient(groupIdA: string, groupIdB: string) {
  return request<TableGroupsResponse>('/api/dashboard/table-groups', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'swap_order', group_id_a: groupIdA, group_id_b: groupIdB }),
  });
}

export async function deleteTableGroupClient(groupId: string) {
  return request<TableGroupsResponse>('/api/dashboard/table-groups', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  });
}

export function mapTableGroupApiError(
  code: string,
  message: string | undefined,
  labels: { duplicateName: string; invalidName: string; saveFail: string; deleteFail: string },
): string {
  switch (code) {
    case 'duplicate_group_name':
      return labels.duplicateName;
    case 'invalid_group_name':
      return labels.invalidName;
    case 'delete_failed':
      return labels.deleteFail;
    default:
      return message || labels.saveFail;
  }
}
