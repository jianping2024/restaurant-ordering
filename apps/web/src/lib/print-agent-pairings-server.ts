import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { maskPairingCode } from '@/lib/print-agent-pairing-code';
import { isPendingPairing } from '@/lib/print-agent-pairing-slots';

export type PrintAgentPairingListItem = {
  id: string;
  expires_at: string;
  consumed_at: string | null;
  code_mask: string;
  pending: boolean;
};

/** Active pairing rows for dashboard (masked codes only; plaintext only from POST /pairing). */
export async function loadPrintAgentPairings(): Promise<PrintAgentPairingListItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('print_agent_pairings')
    .select('id, expires_at, consumed_at, revoked_at, code')
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    return [];
  }

  return (rows || []).map((r) => ({
    id: r.id,
    expires_at: r.expires_at,
    consumed_at: r.consumed_at,
    code_mask: maskPairingCode(String(r.code), Boolean(r.consumed_at)),
    pending: isPendingPairing({
      expires_at: r.expires_at,
      consumed_at: r.consumed_at,
      revoked_at: r.revoked_at,
    }),
  }));
}
