/**
 * Individual checkout — thin reads (service role). Kept free of server-only imports so the claim
 * guard and its tests can load it. Call state lives in `bill_split_ticket_calls`: it carries the
 * guest phone id, which must never be returned to other phones (only `mine` is derived).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IndividualTicketInfo } from '@/lib/individual-checkout';

export type TicketCallRow = {
  ticket_key: string;
  name: string;
  state: 'called' | 'unlocked';
  client_id: string | null;
};

/** Server-internal: rows carry `client_id` — never serialize them to a guest. */
export async function loadTicketCallRows(
  admin: SupabaseClient,
  billSplitId: string,
): Promise<TicketCallRow[]> {
  const { data } = await admin
    .from('bill_split_ticket_calls')
    .select('ticket_key, name, state, client_id')
    .eq('bill_split_id', billSplitId);
  return (data ?? []) as TicketCallRow[];
}

/** Ticket keys currently called (locked for guests and headcount floors). */
export async function loadCalledTicketKeys(
  admin: SupabaseClient,
  billSplitId: string | null | undefined,
): Promise<ReadonlySet<string>> {
  if (!billSplitId) return new Set();
  const rows = await loadTicketCallRows(admin, billSplitId);
  return new Set(rows.filter((row) => row.state === 'called').map((row) => row.ticket_key));
}

/**
 * Ticket call states for the customer/staff read models. `mine` is derived from the asking
 * phone's id; the id itself is never returned.
 */
export async function loadIndividualTickets(
  admin: SupabaseClient,
  params: { billSplitId: string | null | undefined; clientId?: string | null },
): Promise<IndividualTicketInfo[]> {
  if (!params.billSplitId) return [];
  const rows = await loadTicketCallRows(admin, params.billSplitId);
  const clientId = params.clientId?.trim() || null;
  return rows.map((row) => ({
    ticket_key: row.ticket_key,
    name: row.name,
    state: row.state,
    mine: !!clientId && row.client_id === clientId,
  }));
}
