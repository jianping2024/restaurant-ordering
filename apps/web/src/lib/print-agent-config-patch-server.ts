import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyPrintAgentCloudConfigPatch,
  type PrintAgentCloudConfig,
  type PrintAgentCloudConfigPatch,
} from '@/lib/print-agent-config';

type PersistResult =
  | { ok: true; config: PrintAgentCloudConfig }
  | { ok: false; error: string; message?: string };

/** Read-merge-write print_agent_config for owner settings (slice-safe merge). */
export async function mergeAndPersistPrintAgentConfig(
  admin: SupabaseClient,
  restaurantId: string,
  patch: PrintAgentCloudConfigPatch,
): Promise<PersistResult> {
  const { data: row, error: readErr } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', restaurantId)
    .single();

  if (readErr) {
    return { ok: false, error: 'query_failed', message: readErr.message };
  }

  const merged = applyPrintAgentCloudConfigPatch(row?.print_agent_config, patch);
  const { error } = await admin
    .from('restaurants')
    .update({ print_agent_config: merged })
    .eq('id', restaurantId);

  if (error) {
    return { ok: false, error: 'update_failed', message: error.message };
  }

  return { ok: true, config: merged };
}
