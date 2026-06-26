import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadDashboardAccess } from '@/lib/dashboard-access';

export type OwnerAnalyticsContext =
  | { admin: SupabaseClient; restaurantId: string; userId: string }
  | { error: string; status: number; message?: string };

const FORBIDDEN_MESSAGE = '当前账号无权访问增值分析。';

export async function loadOwnerAnalyticsContext(): Promise<OwnerAnalyticsContext> {
  const access = await loadDashboardAccess();
  if (access.mode === 'unauthenticated') {
    return { error: 'unauthorized', status: 401 };
  }
  if (access.mode !== 'owner') {
    return { error: 'forbidden', status: 403, message: FORBIDDEN_MESSAGE };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured', status: 503 };
  }

  return {
    admin,
    restaurantId: access.restaurant.id,
    userId: access.restaurant.owner_id,
  };
}
