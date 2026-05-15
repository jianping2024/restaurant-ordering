/** Session cookie valid for role (tiny payload, not a full board fetch). */
export async function checkStaffSession(
  slug: string,
  role: 'kitchen' | 'waiter',
): Promise<boolean> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/session?role=${role}`,
    { credentials: 'include' },
  );
  return res.ok;
}

export type StaffSessionPostResult = 'ok' | 'invalid_password' | 'rate_limited' | 'error';

export async function postStaffSession(
  slug: string,
  role: 'kitchen' | 'waiter',
  password: string,
): Promise<StaffSessionPostResult> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/staff/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, password }),
  });
  if (res.ok) return 'ok';
  if (res.status === 429) return 'rate_limited';
  if (res.status === 401) {
    try {
      const json = (await res.json()) as { error?: string };
      if (json.error === 'invalid_password') return 'invalid_password';
    } catch {
      /* ignore */
    }
  }
  return 'error';
}

export async function deleteStaffSession(slug: string): Promise<void> {
  await fetch(`/api/restaurants/${encodeURIComponent(slug)}/staff/session`, {
    method: 'DELETE',
    credentials: 'include',
  });
}
