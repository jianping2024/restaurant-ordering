/**
 * Sole browser POST for cold-open takeaway desk (no buffet headcount).
 * Sheet + table-detail confirm both call this — do not inline a second fetch.
 */
export type WaiterOpenTakeawayClientResult =
  | { ok: true; sessionId: string }
  | { ok: false; alreadyOpen: true }
  | { ok: false; alreadyOpen?: false };

export async function postWaiterOpenTakeawayClient(input: {
  restaurantSlug: string;
  tableId: string;
}): Promise<WaiterOpenTakeawayClientResult> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(input.restaurantSlug)}/staff/waiter/open-takeaway`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: input.tableId }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    session_id?: string;
  };
  if (res.status === 409 && data.error === 'already_open') {
    return { ok: false, alreadyOpen: true };
  }
  if (!res.ok || !data.session_id) {
    return { ok: false };
  }
  return { ok: true, sessionId: data.session_id };
}
