import type { SupabaseClient } from '@supabase/supabase-js';
import { randomPairingCode } from './print-agent-pairing-code';

export type FiscalProfile = 'restaurant' | 'retail';

export type RestaurantFiscalPolicy = {
  fiscalProfile: FiscalProfile | null;
  maxFiscalTerminals: number;
  terminalsUsed: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** ONLY read for Ops UI / Agent store-policy pull. */
export async function getRestaurantFiscalPolicy(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<RestaurantFiscalPolicy | null> {
  const { data, error } = await admin
    .from('restaurants')
    .select('fiscal_profile, max_fiscal_terminals')
    .eq('id', restaurantId)
    .maybeSingle();
  if (error || !data) return null;

  const { count } = await admin
    .from('fiscal_terminals')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .is('revoked_at', null);

  return {
    fiscalProfile: (data.fiscal_profile as FiscalProfile | null) ?? null,
    maxFiscalTerminals: data.max_fiscal_terminals ?? 1,
    terminalsUsed: count ?? 0,
  };
}

/** Ops PATCH fiscal policy — ONLY write path for profile + max. */
export async function updateRestaurantFiscalPolicy(
  admin: SupabaseClient,
  input: {
    restaurantId: string;
    fiscalProfile?: FiscalProfile | null;
    maxFiscalTerminals?: number;
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number; detail?: string }> {
  const updates: Record<string, unknown> = {};
  if (input.fiscalProfile !== undefined) {
    if (input.fiscalProfile !== null && input.fiscalProfile !== 'restaurant' && input.fiscalProfile !== 'retail') {
      return { ok: false, error: 'invalid_fiscal_profile', status: 400 };
    }
    updates.fiscal_profile = input.fiscalProfile;
  }
  if (input.maxFiscalTerminals !== undefined) {
    const n = Number(input.maxFiscalTerminals);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, error: 'invalid_max_fiscal_terminals', status: 400 };
    }
    updates.max_fiscal_terminals = n;
  }
  if (!Object.keys(updates).length) {
    return { ok: false, error: 'no_updates', status: 400 };
  }
  const { error } = await admin.from('restaurants').update(updates).eq('id', input.restaurantId);
  if (error) {
    return { ok: false, error: 'update_failed', status: 500, detail: error.message };
  }
  return { ok: true };
}

/** Gate for Ops fiscal signing activate — ONLY fiscal_profile check entry. */
export async function assertFiscalProfileForSigningActivate(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: true; profile: FiscalProfile } | { ok: false; error: string; status: number }> {
  const policy = await getRestaurantFiscalPolicy(admin, restaurantId);
  if (!policy?.fiscalProfile) {
    return { ok: false, error: 'fiscal_profile_missing', status: 409 };
  }
  return { ok: true, profile: policy.fiscalProfile };
}

/** Ops: create one-time terminal pairing code. */
export async function createFiscalTerminalPairingCode(
  admin: SupabaseClient,
  input: { restaurantId: string; actorUserId: string; ttlMinutes?: number },
): Promise<
  | { ok: true; pairingId: string; code: string; expiresAt: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const policy = await getRestaurantFiscalPolicy(admin, input.restaurantId);
  if (!policy) {
    return { ok: false, error: 'not_found', status: 404 };
  }
  if (!policy.fiscalProfile) {
    return { ok: false, error: 'fiscal_profile_missing', status: 409 };
  }
  if (policy.terminalsUsed >= policy.maxFiscalTerminals) {
    return { ok: false, error: 'terminals_full', status: 409 };
  }

  const ttl = input.ttlMinutes ?? 30;
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  const code = randomPairingCode();
  const { data, error } = await admin
    .from('fiscal_terminal_pairings')
    .insert({
      restaurant_id: input.restaurantId,
      code,
      expires_at: expiresAt,
      created_by: input.actorUserId,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { ok: false, error: 'pairing_insert_failed', status: 500, detail: error?.message };
  }
  return { ok: true, pairingId: data.id, code, expiresAt };
}

/** Agent: redeem pairing code → fiscal_terminals row. ONLY terminal register path. */
export async function pairFiscalTerminalWithCode(
  admin: SupabaseClient,
  input: { restaurantId: string; pairingCode: string; label?: string },
): Promise<
  | { ok: true; terminalId: string; opsTerminalRef: string; label: string | null }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const code = input.pairingCode.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'invalid_pairing_code', status: 400 };
  }

  const policy = await getRestaurantFiscalPolicy(admin, input.restaurantId);
  if (!policy) {
    return { ok: false, error: 'not_found', status: 404 };
  }
  if (!policy.fiscalProfile) {
    return { ok: false, error: 'fiscal_profile_missing', status: 409 };
  }
  if (policy.terminalsUsed >= policy.maxFiscalTerminals) {
    return { ok: false, error: 'terminals_full', status: 403 };
  }

  const now = nowIso();
  const { data: pairing, error: pErr } = await admin
    .from('fiscal_terminal_pairings')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .eq('code', code)
    .is('consumed_at', null)
    .is('revoked_at', null)
    .maybeSingle();

  if (pErr) {
    return { ok: false, error: 'pairing_query_failed', status: 500, detail: pErr.message };
  }
  if (!pairing) {
    return { ok: false, error: 'pairing_not_found', status: 404 };
  }
  if (pairing.expires_at < now) {
    return { ok: false, error: 'pairing_expired', status: 410 };
  }

  const { data: terminal, error: tErr } = await admin
    .from('fiscal_terminals')
    .insert({
      restaurant_id: input.restaurantId,
      label: input.label?.trim() || null,
      pairing_id: pairing.id,
      registered_at: now,
      last_seen_at: now,
    })
    .select('id, ops_terminal_ref, label')
    .single();

  if (tErr || !terminal) {
    return { ok: false, error: 'terminal_insert_failed', status: 500, detail: tErr?.message };
  }

  await admin
    .from('fiscal_terminal_pairings')
    .update({ consumed_at: now })
    .eq('id', pairing.id)
    .is('consumed_at', null);

  return {
    ok: true,
    terminalId: terminal.id,
    opsTerminalRef: terminal.ops_terminal_ref,
    label: terminal.label,
  };
}

/** Ops: revoke terminal (soft). */
export async function revokeFiscalTerminal(
  admin: SupabaseClient,
  input: { restaurantId: string; terminalId: string },
): Promise<{ ok: true } | { ok: false; error: string; status: number; detail?: string }> {
  const ts = nowIso();
  const { error } = await admin
    .from('fiscal_terminals')
    .update({ active: false, revoked_at: ts })
    .eq('id', input.terminalId)
    .eq('restaurant_id', input.restaurantId)
    .is('revoked_at', null);
  if (error) {
    return { ok: false, error: 'revoke_failed', status: 500, detail: error.message };
  }
  return { ok: true };
}

/** Agent pull: sync terminal active flags from Ops. */
export async function listFiscalTerminalsForAgent(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<Array<{ id: string; opsTerminalRef: string; label: string | null; active: boolean }>> {
  const { data } = await admin
    .from('fiscal_terminals')
    .select('id, ops_terminal_ref, label, active, revoked_at')
    .eq('restaurant_id', restaurantId);
  return (data ?? [])
    .filter((r) => !r.revoked_at)
    .map((r) => ({
      id: r.id,
      opsTerminalRef: r.ops_terminal_ref,
      label: r.label,
      active: r.active,
    }));
}
