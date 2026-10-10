/** Client call for staff individual-checkout ticket unlock. */

export type IndividualUnlockOutcome = { ok: true } | { ok: false; error: string };

/** Staff「解锁」: delete called, uncollected tickets (dishes return to the pool). */
export async function requestStaffUnlockTickets(params: {
  slug: string;
  tableId: string;
  ticketKeys: string[];
}): Promise<IndividualUnlockOutcome> {
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(params.slug)}/checkout/unlock-ticket`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: params.tableId, ticket_keys: params.ticketKeys }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? 'unlock_failed' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'network' };
  }
}
