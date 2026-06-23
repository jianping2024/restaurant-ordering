import type { SupabaseClient } from '@supabase/supabase-js';

export type RevokePrintAgentDeviceResult =
  | { ok: true; deviceId: string; restaurantId: string }
  | { ok: false; error: 'not_found' | 'update_failed'; detail?: string };

export type RevokePrintAgentPairingResult =
  | { ok: true; pairingId: string; restaurantId: string }
  | { ok: false; error: 'not_revokable' | 'update_failed'; detail?: string };

/** Set revoked_at on an active print agent device (tenant-scoped by restaurant_id). */
export async function revokePrintAgentDevice(
  admin: SupabaseClient,
  deviceId: string,
  restaurantId: string,
): Promise<RevokePrintAgentDeviceResult> {
  const nowIso = new Date().toISOString();
  const { data: row, error } = await admin
    .from('print_agent_devices')
    .update({ revoked_at: nowIso })
    .eq('id', deviceId)
    .eq('restaurant_id', restaurantId)
    .is('revoked_at', null)
    .select('id, restaurant_id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: 'update_failed', detail: error.message };
  }
  if (!row) {
    return { ok: false, error: 'not_found' };
  }
  return { ok: true, deviceId: row.id, restaurantId: row.restaurant_id };
}

/** Void an unused, unexpired pairing code (tenant-scoped by restaurant_id). */
export async function revokePrintAgentPairing(
  admin: SupabaseClient,
  pairingId: string,
  restaurantId: string,
): Promise<RevokePrintAgentPairingResult> {
  const nowIso = new Date().toISOString();
  const { data: row, error } = await admin
    .from('print_agent_pairings')
    .update({ revoked_at: nowIso })
    .eq('id', pairingId)
    .eq('restaurant_id', restaurantId)
    .is('consumed_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id, restaurant_id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: 'update_failed', detail: error.message };
  }
  if (!row) {
    return { ok: false, error: 'not_revokable' };
  }
  return { ok: true, pairingId: row.id, restaurantId: row.restaurant_id };
}
