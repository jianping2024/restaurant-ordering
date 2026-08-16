import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isOnPremInstallHost } from '@/lib/license-on-prem-host';
import {
  PREM_BUILTIN_ADMIN_ACCOUNT_TYPE,
  PREM_BUILTIN_ADMIN_EMAIL,
  isPremBuiltinAdminMetadata,
} from '@/lib/auth/prem-builtin-admin-identity';

export {
  PREM_BUILTIN_ADMIN_ACCOUNT_TYPE,
  PREM_BUILTIN_ADMIN_EMAIL,
  isPremBuiltinAdminActor,
  isPremBuiltinAdminEmail,
  isPremBuiltinAdminLoginName,
  isPremBuiltinAdminMetadata,
  PREM_BUILTIN_ADMIN_LOGIN_NAME,
} from '@/lib/auth/prem-builtin-admin-identity';

/** Default password for the prem built-in admin — install/ensure only; not forced to change. */
export const PREM_BUILTIN_ADMIN_PASSWORD = 'centos(123)';

export type ClaimedOnPremRestaurant = { id: string; slug: string };

/**
 * Sole activation gate: prem host has a claimed restaurant
 * (deployment_mode=on_prem + owner_id set). Does not touch owner_id.
 */
export async function loadClaimedOnPremRestaurant(
  admin: SupabaseClient,
): Promise<ClaimedOnPremRestaurant | null> {
  if (!isOnPremInstallHost()) return null;

  const { data, error } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('deployment_mode', 'on_prem')
    .not('owner_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data?.id || typeof data.slug !== 'string') return null;
  return { id: data.id as string, slug: data.slug };
}

/**
 * Idempotent Auth user for prem built-in admin. No-op off prem.
 * Does not create a staff row or set restaurants.owner_id.
 */
export async function ensurePremBuiltinAdminUser(
  admin: SupabaseClient,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  if (!isOnPremInstallHost()) {
    return { ok: false, error: 'not_on_prem' };
  }

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (list.error) {
    return { ok: false, error: list.error.message };
  }
  const existing = list.data.users.find(
    (u) => (u.email || '').trim().toLowerCase() === PREM_BUILTIN_ADMIN_EMAIL,
  );
  if (existing) {
    const meta = (existing.user_metadata as Record<string, unknown>) ?? {};
    if (!isPremBuiltinAdminMetadata(meta)) {
      const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
        user_metadata: {
          ...meta,
          account_type: PREM_BUILTIN_ADMIN_ACCOUNT_TYPE,
        },
      });
      if (updErr) return { ok: false, error: updErr.message };
    }
    return { ok: true, userId: existing.id };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: PREM_BUILTIN_ADMIN_EMAIL,
    password: PREM_BUILTIN_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      account_type: PREM_BUILTIN_ADMIN_ACCOUNT_TYPE,
    },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message || 'create_user_failed' };
  }
  return { ok: true, userId: data.user.id };
}
