import type { BuffetDashboardData } from '@/lib/dashboard-buffet-server';
import type { BuffetTimeSlot } from '@/types';

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

export async function fetchBuffetDashboardClient() {
  return request<BuffetDashboardData>('/api/dashboard/buffet', { method: 'GET' });
}

export async function createBuffetClient(name: string) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', name }),
  });
}

export async function createBuffetSlotClient(name: string, sortOrder: number) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', name, sort_order: sortOrder }),
  });
}

export async function createBuffetRuleClient(rule: Record<string, unknown>) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', rule }),
  });
}

export async function upsertBuffetCalendarClient(
  rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>,
) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'calendar', rows }),
  });
}

export async function updateBuffetClient(
  id: string,
  patch: Partial<Pick<import('@/types').Buffet, 'name' | 'is_active'>>,
) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', id, patch }),
  });
}

export async function updateBuffetSlotClient(id: string, patch: Partial<BuffetTimeSlot>) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', id, patch }),
  });
}

export async function updateBuffetRuleClient(id: string, rule: Record<string, unknown>) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', id, rule }),
  });
}

export async function toggleBuffetRuleActiveClient(id: string, isActive: boolean) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule_toggle', id, is_active: isActive }),
  });
}

export async function updateBuffetFridayPolicyClient(buffetFridayWeekendFrom: string | null) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'friday_policy', buffet_friday_weekend_from: buffetFridayWeekendFrom }),
  });
}

export async function deleteBuffetClient(id: string) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', id }),
  });
}

export async function deleteBuffetSlotClient(id: string) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', id }),
  });
}

export async function deleteBuffetRuleClient(id: string) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', id }),
  });
}

export async function deleteBuffetCalendarClient(onDate: string) {
  return request<BuffetDashboardData>('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'calendar', on_date: onDate }),
  });
}
