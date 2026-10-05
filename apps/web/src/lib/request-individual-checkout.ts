/** Client calls for individual-checkout ticket unlock (staff + guest). */

export type IndividualUnlockOutcome = { ok: true } | { ok: false; error: string };

async function postUnlock(url: string, body: Record<string, unknown>): Promise<IndividualUnlockOutcome> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'unlock_failed' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}

/** Staff「解锁」: send called, uncollected tickets back to draft. */
export function requestStaffUnlockTickets(params: {
  slug: string;
  tableId: string;
  ticketKeys: string[];
}): Promise<IndividualUnlockOutcome> {
  return postUnlock(
    `/api/restaurants/${encodeURIComponent(params.slug)}/checkout/unlock-ticket`,
    { table_id: params.tableId, ticket_keys: params.ticketKeys },
  );
}

/** Guest「恢复点单」: unlock every ticket this phone called (none paid / collected yet). */
export function requestGuestUnlockTickets(params: {
  slug: string;
  tableId: string;
  guestClientId: string;
}): Promise<IndividualUnlockOutcome> {
  return postUnlock(
    `/api/restaurants/${encodeURIComponent(params.slug)}/checkout/individual-unlock`,
    { table_id: params.tableId, guest_client_id: params.guestClientId },
  );
}
