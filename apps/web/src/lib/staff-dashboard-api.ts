import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import { isPrintAgentStaffRole } from '@mesa/shared';
import {
  validateLoginName,
  type StaffUserMetadata,
} from '@/lib/staff-account';
import { accountPasswordPolicyError } from '@/lib/auth/account-password-policy';
import type { RestaurantStaffAccount } from '@/types';
import type { StaffRole } from '@/lib/staff-account';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadOwnerRestaurantWithSlug(options?: { requireWritable?: boolean }) {
  const auth = await requireSettingsRestaurantAuth('settings.staff.manage', options);
  if (auth instanceof NextResponse) {
    const body = (await auth.json().catch(() => ({}))) as { error?: string };
    return { error: (body.error ?? 'forbidden') as string, status: auth.status };
  }

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

function roleNameFromRow(row: Record<string, unknown>): string {
  const embedded = row.restaurant_roles;
  if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
    const name = (embedded as { name?: string }).name;
    if (typeof name === 'string' && name.trim()) return name;
  }
  return String(row.role ?? '');
}

export function mapStaffRow(row: Record<string, unknown>): RestaurantStaffAccount {
  return {
    id: row.id as string,
    restaurant_id: row.restaurant_id as string,
    user_id: row.user_id as string,
    role_id: String(row.role_id ?? ''),
    role_name: roleNameFromRow(row),
    role: String(row.role ?? ''),
    display_name: row.display_name as string,
    login_name: row.login_name as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    disabled_at: (row.disabled_at as string | null) ?? null,
  };
}

/** Human staff only — system print_agent never appears in owner staff lists. */
export function mapHumanStaffRows(rows: Record<string, unknown>[]): RestaurantStaffAccount[] {
  return rows.filter((row) => !isPrintAgentStaffRole(String(row.role ?? ''))).map(mapStaffRow);
}

const STAFF_LIST_SELECT =
  'id, restaurant_id, user_id, role, role_id, display_name, login_name, created_at, updated_at, disabled_at, restaurant_roles(name)';

/**
 * Full restaurant human staff roster for settings.staff.manage (admin client; bypasses staff self-select RLS).
 * Single query+map path shared by GET /api/dashboard/staff and settings SSR.
 */
export async function listHumanStaffAccountsForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ staff: RestaurantStaffAccount[]; error: { code?: string; message: string } | null }> {
  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .select(STAFF_LIST_SELECT)
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true });

  if (error) {
    return {
      staff: [],
      error: { code: error.code, message: error.message },
    };
  }
  return {
    staff: mapHumanStaffRows((data || []) as Record<string, unknown>[]),
    error: null,
  };
}

export function staffMetadataPayload(
  accountId: string,
  restaurantId: string,
  slug: string,
  roleLabel: string,
  mustChangePassword: boolean,
): StaffUserMetadata {
  return {
    account_type: 'staff',
    must_change_password: mustChangePassword,
    staff_role: roleLabel as StaffRole,
    restaurant_id: restaurantId,
    staff_account_id: accountId,
    restaurant_slug: slug,
  };
}

export function validateStaffCreateBody(body: Record<string, unknown>) {
  const display_name = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  const loginRaw = typeof body.login_name === 'string' ? body.login_name : '';
  const role_id = typeof body.role_id === 'string' ? body.role_id.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!display_name) return { error: 'display_name_required' as const };
  const login = validateLoginName(loginRaw);
  if (!login.ok) return { error: `login_name_${login.code}` as const };
  if (!role_id) return { error: 'invalid_role' as const };
  const passwordError = accountPasswordPolicyError(password, {
    loginName: login.normalized,
  });
  if (passwordError) return { error: passwordError };

  return {
    display_name,
    login_name: login.normalized,
    role_id,
    password,
  };
}

export function validateStaffRoleChange(body: Record<string, unknown>) {
  const role_id = typeof body.role_id === 'string' ? body.role_id.trim() : '';
  if (!role_id) return { error: 'invalid_role' as const };
  return { role_id };
}
