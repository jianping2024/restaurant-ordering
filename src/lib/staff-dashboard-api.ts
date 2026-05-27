import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';
import {
  staffPasswordValid,
  validateLoginName,
  type StaffUserMetadata,
} from '@/lib/staff-account';
import type { StaffAccountRole, RestaurantStaffAccount } from '@/types';
import type { StaffRole } from '@/lib/staff-account';

export async function loadOwnerRestaurantWithSlug() {
  const auth = await getOwnerRestaurantId();
  if ('error' in auth) return auth;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: 'server_misconfigured' as const, status: 503 };
  }

  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('id, name, slug, owner_id')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (error || !restaurant) {
    return { error: 'restaurant_not_found' as const, status: 404 };
  }

  return { admin, restaurant: restaurant as { id: string; name: string; slug: string; owner_id: string } };
}

export function mapStaffRow(row: Record<string, unknown>): RestaurantStaffAccount {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    user_id: row.user_id as string,
    role: row.role as StaffAccountRole,
    display_name: row.display_name as string,
    login_name: row.login_name as string,
    email: row.email as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    disabled_at: (row.disabled_at as string | null) ?? null,
  };
}

export async function kickStaffUserSessions(admin: ReturnType<typeof createAdminClient>, userId: string) {
  try {
    await admin.auth.admin.signOut(userId, 'global');
  } catch {
    // best-effort
  }
}

export async function setStaffUserBanned(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  banned: boolean,
) {
  await admin.auth.admin.updateUserById(userId, {
    ban_duration: banned ? '876000h' : 'none',
  });
}

export function staffMetadataPayload(
  accountId: string,
  restaurantId: string,
  slug: string,
  role: StaffRole,
  mustChangePassword: boolean,
): StaffUserMetadata {
  return {
    account_type: 'staff',
    must_change_password: mustChangePassword,
    staff_role: role,
    restaurant_id: restaurantId,
    staff_account_id: accountId,
    restaurant_slug: slug,
  };
}

export function validateStaffCreateBody(body: Record<string, unknown>) {
  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const loginRaw = typeof body.login_name === 'string' ? body.login_name : '';
  const role = body.role;
  const password = typeof body.password === 'string' ? body.password : '';

  if (!display_name) return { error: 'display_name_required' as const };
  const login = validateLoginName(loginRaw);
  if (!login.ok) return { error: `login_name_${login.code}` as const };
  if (role !== 'kitchen' && role !== 'waiter' && role !== 'cashier') {
    return { error: 'invalid_role' as const };
  }
  if (!staffPasswordValid(password)) return { error: 'password_too_short' as const };

  return {
    display_name,
    login_name: login.normalized,
    role: role as StaffAccountRole,
    password,
  };
}
