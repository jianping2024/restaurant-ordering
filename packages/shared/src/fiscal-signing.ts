import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fiscalProductPublicKeyPem,
  loadFiscalProductPrivateKeyPem,
  wrapFiscalProductPem,
} from './fiscal-product-wrap';

export type FiscalSigningStatus = 'none' | 'registered' | 'active' | 'revoked';

export type FiscalSigningInstallationRow = {
  id: string;
  restaurant_id: string;
  device_id: string;
  device_public_key: string;
  signing_key_version: number;
  product_public_key_pem: string | null;
  wrapped_private_key: string | null;
  status: 'registered' | 'active' | 'revoked';
  activated_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalSigningRestaurantStatus = {
  status: FiscalSigningStatus;
  installationId: string | null;
  deviceId: string | null;
  signingKeyVersion: number | null;
  activatedAt: string | null;
  revokedAt: string | null;
  hasDevicePublicKey: boolean;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** ONLY status read for Ops / Agent summaries. */
export async function getFiscalSigningRestaurantStatus(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<FiscalSigningRestaurantStatus> {
  const { data: active } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'active')
    .maybeSingle();

  if (active) {
    return {
      status: 'active',
      installationId: active.id,
      deviceId: active.device_id,
      signingKeyVersion: active.signing_key_version,
      activatedAt: active.activated_at,
      revokedAt: null,
      hasDevicePublicKey: Boolean(active.device_public_key),
    };
  }

  const { data: registered } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'registered')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (registered) {
    return {
      status: 'registered',
      installationId: registered.id,
      deviceId: registered.device_id,
      signingKeyVersion: registered.signing_key_version,
      activatedAt: null,
      revokedAt: null,
      hasDevicePublicKey: Boolean(registered.device_public_key),
    };
  }

  const { data: revoked } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'revoked')
    .order('revoked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (revoked) {
    return {
      status: 'revoked',
      installationId: revoked.id,
      deviceId: revoked.device_id,
      signingKeyVersion: revoked.signing_key_version,
      activatedAt: revoked.activated_at,
      revokedAt: revoked.revoked_at,
      hasDevicePublicKey: Boolean(revoked.device_public_key),
    };
  }

  return {
    status: 'none',
    installationId: null,
    deviceId: null,
    signingKeyVersion: null,
    activatedAt: null,
    revokedAt: null,
    hasDevicePublicKey: false,
  };
}

/**
 * Agent registers device public key B'.
 * ONLY register write path.
 */
export async function registerFiscalSigningDevice(
  admin: SupabaseClient,
  input: { restaurantId: string; deviceId: string; devicePublicKey: string },
): Promise<
  | { ok: true; installation: FiscalSigningInstallationRow }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const devicePublicKey = input.devicePublicKey.trim();
  if (!devicePublicKey.includes('BEGIN PUBLIC KEY')) {
    return { ok: false, error: 'invalid_device_public_key', status: 400 };
  }

  const { data: existingOpen } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .eq('device_id', input.deviceId)
    .in('status', ['registered', 'active'])
    .maybeSingle();

  const ts = nowIso();

  if (existingOpen) {
    if (existingOpen.status === 'active') {
      if (existingOpen.device_public_key.trim() === devicePublicKey) {
        return { ok: true, installation: existingOpen as FiscalSigningInstallationRow };
      }
      return { ok: false, error: 'device_key_mismatch_while_active', status: 409 };
    }
    const { data: updated, error } = await admin
      .from('fiscal_signing_installations')
      .update({ device_public_key: devicePublicKey, updated_at: ts })
      .eq('id', existingOpen.id)
      .eq('status', 'registered')
      .select('*')
      .single();
    if (error || !updated) {
      return { ok: false, error: 'register_update_failed', status: 500, detail: error?.message };
    }
    return { ok: true, installation: updated as FiscalSigningInstallationRow };
  }

  const { data: inserted, error } = await admin
    .from('fiscal_signing_installations')
    .insert({
      restaurant_id: input.restaurantId,
      device_id: input.deviceId,
      device_public_key: devicePublicKey,
      signing_key_version: 1,
      status: 'registered',
      created_at: ts,
      updated_at: ts,
    })
    .select('*')
    .single();

  if (error || !inserted) {
    return { ok: false, error: 'register_insert_failed', status: 500, detail: error?.message };
  }
  return { ok: true, installation: inserted as FiscalSigningInstallationRow };
}

/**
 * Ops activate: wrap A for registered device → status=active.
 * Revokes any prior active for the restaurant first (new installation wins).
 * ONLY activate / wrap write path.
 */
export async function activateFiscalSigning(
  admin: SupabaseClient,
  input: { restaurantId: string; actorUserId: string },
): Promise<
  | { ok: true; installation: FiscalSigningInstallationRow }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const productPem = loadFiscalProductPrivateKeyPem();
  if (!productPem) {
    return { ok: false, error: 'product_key_not_configured', status: 503 };
  }

  const { data: registered } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .eq('status', 'registered')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!registered) {
    return { ok: false, error: 'device_not_registered', status: 409 };
  }

  let wrapped: string;
  let productPub: string;
  try {
    wrapped = wrapFiscalProductPem(registered.device_public_key, productPem);
    productPub = fiscalProductPublicKeyPem(productPem);
  } catch (e) {
    return {
      ok: false,
      error: 'wrap_failed',
      status: 500,
      detail: e instanceof Error ? e.message : String(e),
    };
  }

  const ts = nowIso();

  const { data: priorActive } = await admin
    .from('fiscal_signing_installations')
    .select('id')
    .eq('restaurant_id', input.restaurantId)
    .eq('status', 'active');

  for (const row of priorActive ?? []) {
    const { error: revErr } = await admin
      .from('fiscal_signing_installations')
      .update({
        status: 'revoked',
        revoked_at: ts,
        revoked_by: input.actorUserId,
        wrapped_private_key: null,
        updated_at: ts,
      })
      .eq('id', row.id)
      .eq('status', 'active');
    if (revErr) {
      return { ok: false, error: 'revoke_prior_failed', status: 500, detail: revErr.message };
    }
  }

  const { data: activated, error } = await admin
    .from('fiscal_signing_installations')
    .update({
      status: 'active',
      wrapped_private_key: wrapped,
      product_public_key_pem: productPub,
      signing_key_version: registered.signing_key_version || 1,
      activated_at: ts,
      activated_by: input.actorUserId,
      updated_at: ts,
    })
    .eq('id', registered.id)
    .eq('status', 'registered')
    .select('*')
    .single();

  if (error || !activated) {
    return { ok: false, error: 'activate_failed', status: 500, detail: error?.message };
  }
  return { ok: true, installation: activated as FiscalSigningInstallationRow };
}

/**
 * Ops revoke active (or registered) installation — terminal. ONLY revoke path.
 * Does not resurrect: revoked rows stay revoked.
 */
export async function revokeFiscalSigning(
  admin: SupabaseClient,
  input: { restaurantId: string; actorUserId: string; installationId?: string },
): Promise<
  | { ok: true; installationId: string }
  | { ok: false; error: string; status: number; detail?: string }
> {
  const ts = nowIso();
  let q = admin
    .from('fiscal_signing_installations')
    .select('id, status')
    .eq('restaurant_id', input.restaurantId)
    .in('status', ['registered', 'active']);

  if (input.installationId) {
    q = q.eq('id', input.installationId);
  }

  const { data: rows, error: fetchErr } = await q;
  if (fetchErr) {
    return { ok: false, error: 'fetch_failed', status: 500, detail: fetchErr.message };
  }
  if (!rows?.length) {
    return { ok: false, error: 'not_found', status: 404 };
  }

  let lastId = '';
  for (const row of rows) {
    const { error } = await admin
      .from('fiscal_signing_installations')
      .update({
        status: 'revoked',
        revoked_at: ts,
        revoked_by: input.actorUserId,
        wrapped_private_key: null,
        updated_at: ts,
      })
      .eq('id', row.id)
      .in('status', ['registered', 'active']);
    if (error) {
      return { ok: false, error: 'revoke_failed', status: 500, detail: error.message };
    }
    lastId = row.id;
  }
  return { ok: true, installationId: lastId };
}

/** Agent pulls active wrapped key for this device — ONLY provision read path. */
export async function pullFiscalSigningProvision(
  admin: SupabaseClient,
  input: { restaurantId: string; deviceId: string },
): Promise<
  | {
      ok: true;
      installationId: string;
      signingKeyVersion: number;
      productPublicKeyPem: string;
      wrappedPrivateKey: string;
    }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await admin
    .from('fiscal_signing_installations')
    .select('*')
    .eq('restaurant_id', input.restaurantId)
    .eq('device_id', input.deviceId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    return { ok: false, error: 'query_failed', status: 500 };
  }
  if (!data?.wrapped_private_key || !data.product_public_key_pem) {
    return { ok: false, error: 'not_active', status: 404 };
  }
  return {
    ok: true,
    installationId: data.id,
    signingKeyVersion: data.signing_key_version,
    productPublicKeyPem: data.product_public_key_pem,
    wrappedPrivateKey: data.wrapped_private_key,
  };
}
