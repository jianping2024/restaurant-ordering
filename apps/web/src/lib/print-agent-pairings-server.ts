import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import { pairingListCode } from '@/lib/print-agent-pairing-code';
import { isPendingPairing } from '@/lib/print-agent-pairing-slots';

export type PrintAgentPairingListItem = {
  id: string;
  expires_at: string;
  consumed_at: string | null;
  /** Pending: full 6-digit code. Consumed: `******`. */
  code: string;
  pending: boolean;
};

/** Active pairing rows for one store's dashboard (pending codes are plaintext). */
export async function loadPrintAgentPairings(
  restaurantId: AuthorizedRestaurantId,
): Promise<PrintAgentPairingListItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('print_agent_pairings')
    .select('id, expires_at, consumed_at, revoked_at, code')
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return [];
  }

  return (rows || []).map((r) => {
    const consumed = Boolean(r.consumed_at);
    return {
      id: r.id,
      expires_at: r.expires_at,
      consumed_at: r.consumed_at,
      code: pairingListCode(String(r.code), consumed),
      pending: isPendingPairing({
        expires_at: r.expires_at,
        consumed_at: r.consumed_at,
        revoked_at: r.revoked_at,
      }),
    };
  });
}
