import type { BuffetDashboardPatch } from '@/lib/buffet-dashboard-patch';
import type { BuffetTimeSlot } from '@/types';

type ApiError = { error: string; message?: string };

type BuffetMutationResponse = { patch: BuffetDashboardPatch };

async function parseJson<T>(res: Response): Promise<T & ApiError> {
  return (await res.json().catch(() => ({}))) as T & ApiError;
}

async function requestPatch(
  url: string,
  init?: RequestInit,
): Promise<
  { ok: true; patch: BuffetDashboardPatch } | { ok: false; error: string; message?: string }
> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    const data = await parseJson<BuffetMutationResponse>(res);
    if (!res.ok) {
      return { ok: false, error: data.error || 'request_failed', message: data.message };
    }
    if (!data.patch || typeof data.patch !== 'object') {
      return { ok: false, error: 'invalid_patch_response' };
    }
    return { ok: true, patch: data.patch };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export async function createBuffetClient(name: string) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', name }),
  });
}

export async function createBuffetSlotClient(name: string, sortOrder: number) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', name, sort_order: sortOrder }),
  });
}

export async function createBuffetRuleClient(rule: Record<string, unknown>) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', rule }),
  });
}

export async function upsertBuffetCalendarClient(
  rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>,
) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'calendar', rows }),
  });
}

export async function updateBuffetClient(
  id: string,
  patch: Partial<Pick<import('@/types').Buffet, 'name' | 'is_active'>>,
) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', id, patch }),
  });
}

export async function updateBuffetSlotClient(id: string, patch: Partial<BuffetTimeSlot>) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', id, patch }),
  });
}

export async function updateBuffetRuleClient(id: string, rule: Record<string, unknown>) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', id, rule }),
  });
}

export async function toggleBuffetRuleActiveClient(id: string, isActive: boolean) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule_toggle', id, is_active: isActive }),
  });
}

export async function updateBuffetFridayPolicyClient(buffetFridayWeekendFrom: string | null) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resource: 'friday_policy',
      buffet_friday_weekend_from: buffetFridayWeekendFrom,
    }),
  });
}

export async function deleteBuffetClient(id: string) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'buffet', id }),
  });
}

export async function deleteBuffetSlotClient(id: string) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'slot', id }),
  });
}

export async function deleteBuffetRuleClient(id: string) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'rule', id }),
  });
}

export async function deleteBuffetCalendarClient(onDate: string) {
  return requestPatch('/api/dashboard/buffet', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resource: 'calendar', on_date: onDate }),
  });
}
