/**
 * Sole Ops hard-delete path for a restaurant: platform DB + Auth + menu-images.
 * Does not touch on-prem store local databases.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadRestaurantInstallContexts } from '@/lib/ops-restaurant-install-context';
import {
  isOpsRestaurantDeletable,
  resolveOpsLicenseHealth,
} from '@/lib/ops-license-status';
import { writePlatformAudit } from '@/lib/platform-audit';

export type PurgeRestaurantInput = {
  admin: SupabaseClient;
  restaurantId: string;
  confirmSlug: string;
  actorUserId: string;
};

export type PurgeRestaurantOk = {
  ok: true;
  restaurantId: string;
  slug: string;
  authUsersDeleted: number;
  authUsersFailed: number;
};

export type PurgeRestaurantErr = {
  ok: false;
  error: string;
  status: number;
  detail?: string;
  message?: string;
};

async function removeMenuImagesPrefix(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  const { data: entries, error } = await admin.storage
    .from('menu-images')
    .list(restaurantId, { limit: 1000 });
  if (error || !entries?.length) return;

  const paths = entries
    .filter((e) => e.name && !e.name.endsWith('/'))
    .map((e) => `${restaurantId}/${e.name}`);
  if (paths.length === 0) return;
  await admin.storage.from('menu-images').remove(paths);
}

export async function purgeRestaurantForOps(
  input: PurgeRestaurantInput,
): Promise<PurgeRestaurantOk | PurgeRestaurantErr> {
  const { admin, restaurantId, actorUserId } = input;
  const confirmSlug = input.confirmSlug.trim().toLowerCase();
  if (!confirmSlug) {
    return { ok: false, error: 'slug_required', status: 400 };
  }

  const { data: restaurant, error: fetchError } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, owner_id, deployment_mode, suspended_at, suspension_reason, license_valid_until, license_checked_at, license_offline_grace_days',
    )
    .eq('id', restaurantId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: 'fetch_failed', status: 500, detail: fetchError.message };
  }
  if (!restaurant) {
    return { ok: false, error: 'not_found', status: 404 };
  }

  if (confirmSlug !== String(restaurant.slug).toLowerCase()) {
    return {
      ok: false,
      error: 'slug_mismatch',
      status: 409,
      message: '请输入正确的餐厅 slug 以确认删除。',
    };
  }

  const installById = await loadRestaurantInstallContexts(admin, [restaurant.id]);
  const installCtx = installById.get(restaurant.id)!;
  const health = resolveOpsLicenseHealth({
    deploymentMode: restaurant.deployment_mode,
    suspendedAt: restaurant.suspended_at,
    suspensionReason: restaurant.suspension_reason,
    licenseValidUntil: restaurant.license_valid_until,
    licenseCheckedAt: restaurant.license_checked_at,
    lastCheckinAt: installCtx.lastCheckinAt,
    installPhase: installCtx.installPhase,
    offlineGraceDays: restaurant.license_offline_grace_days,
  });

  if (!isOpsRestaurantDeletable(health)) {
    return {
      ok: false,
      error: 'restaurant_operating',
      status: 409,
      message: '营业中的餐厅不可删除，请先暂停后再删。',
    };
  }

  const { data: staffRows, error: staffError } = await admin
    .from('restaurant_staff_accounts')
    .select('id, user_id')
    .eq('restaurant_id', restaurant.id);

  if (staffError) {
    return { ok: false, error: 'staff_fetch_failed', status: 500, detail: staffError.message };
  }

  const authUserIds = new Set<string>();
  if (restaurant.owner_id) authUserIds.add(restaurant.owner_id);
  for (const row of staffRows || []) {
    if (row.user_id) authUserIds.add(row.user_id as string);
  }

  await writePlatformAudit(admin, {
    actorUserId,
    action: 'restaurant.delete',
    targetType: 'restaurant',
    targetId: restaurant.id,
    restaurantId: restaurant.id,
    metadata: {
      name: restaurant.name,
      slug: restaurant.slug,
      deploymentMode: restaurant.deployment_mode,
      staffCount: (staffRows || []).length,
      authUserCount: authUserIds.size,
      primaryKind: health.primary.kind,
    },
  });

  await removeMenuImagesPrefix(admin, restaurant.id);

  // Clear staff first so role_id ON DELETE RESTRICT cannot block restaurant CASCADE.
  if ((staffRows || []).length > 0) {
    const { error: staffDelError } = await admin
      .from('restaurant_staff_accounts')
      .delete()
      .eq('restaurant_id', restaurant.id);
    if (staffDelError) {
      return {
        ok: false,
        error: 'staff_delete_failed',
        status: 500,
        detail: staffDelError.message,
      };
    }
  }

  const { error: restaurantDelError } = await admin
    .from('restaurants')
    .delete()
    .eq('id', restaurant.id);

  if (restaurantDelError) {
    return {
      ok: false,
      error: 'restaurant_delete_failed',
      status: 500,
      detail: restaurantDelError.message,
    };
  }

  let authUsersDeleted = 0;
  let authUsersFailed = 0;
  for (const userId of Array.from(authUserIds)) {
    const { error: delUserError } = await admin.auth.admin.deleteUser(userId);
    if (delUserError) {
      authUsersFailed += 1;
    } else {
      authUsersDeleted += 1;
    }
  }

  return {
    ok: true,
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    authUsersDeleted,
    authUsersFailed,
  };
}
