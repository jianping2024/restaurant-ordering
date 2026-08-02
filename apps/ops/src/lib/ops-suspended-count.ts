/**
 * Sole Ops suspended-count path: same resolveOpsLicenseHealth as list/detail badges.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isOpsPrimarySuspended,
  resolveOpsLicenseHealth,
} from '@/lib/ops-license-status';
import { loadRestaurantInstallContexts } from '@/lib/ops-restaurant-install-context';

const HEALTH_SELECT =
  'id, deployment_mode, suspended_at, suspension_reason, license_valid_until, license_checked_at, license_offline_grace_days';

export async function countOpsSuspendedRestaurants(
  admin: SupabaseClient,
  now: Date = new Date(),
): Promise<{ restaurantCount: number; suspendedCount: number }> {
  const { data: rows, error } = await admin.from('restaurants').select(HEALTH_SELECT);
  if (error) {
    throw new Error(error.message);
  }
  const list = rows || [];
  const installById = await loadRestaurantInstallContexts(
    admin,
    list.map((r) => r.id as string),
  );

  let suspendedCount = 0;
  for (const r of list) {
    const ctx = installById.get(r.id as string)!;
    const health = resolveOpsLicenseHealth({
      now,
      deploymentMode: r.deployment_mode,
      suspendedAt: r.suspended_at,
      suspensionReason: r.suspension_reason,
      licenseValidUntil: r.license_valid_until,
      licenseCheckedAt: r.license_checked_at,
      lastCheckinAt: ctx.lastCheckinAt,
      installPhase: ctx.installPhase,
      offlineGraceDays: r.license_offline_grace_days,
    });
    if (isOpsPrimarySuspended(health)) suspendedCount += 1;
  }

  return { restaurantCount: list.length, suspendedCount };
}
