'use client';

import { createClient } from '@/lib/supabase/client';
import { buildStaffEmail, parseStaffUserMetadata } from '@/lib/staff-account';
import type { StaffAccountRole } from '@/types';
import type { StaffRole } from '@/lib/staff-account';

export type StaffSessionState =
  | { status: 'ok'; role: StaffRole; slug: string; asOwner?: boolean }
  | { status: 'needs_password_change' }
  | { status: 'unauthenticated' }
  | { status: 'wrong_context' };

export function staffRolePath(slug: string, role: StaffRole): string {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  if (role === 'cashier') return '/dashboard/checkout';
  return `/${slug}/waiter`;
}

export type StaffLoginRedirect =
  | { kind: 'owner' }
  | { kind: 'staff'; path: string; mustChangePassword: boolean }
  | { kind: 'staff_error'; code: 'disabled' | 'incomplete' };

function isStaffRole(role: string): role is StaffRole {
  return role === 'kitchen' || role === 'waiter' || role === 'cashier';
}

/** After sign-in: DB role + slug win over JWT metadata (fixes stale/wrong staff_role). */
export async function resolveStaffLoginRedirect(
  userId: string,
  userMetadata: Record<string, unknown> | undefined,
): Promise<StaffLoginRedirect> {
  const supabase = createClient();
  const meta = parseStaffUserMetadata(userMetadata);

  const { data: account } = await supabase
    .from('restaurant_staff_accounts')
    .select('role, restaurant_id, disabled_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!account) {
    if (meta?.account_type === 'staff') {
      return { kind: 'staff_error', code: 'incomplete' };
    }
    return { kind: 'owner' };
  }

  if (account.disabled_at) {
    return { kind: 'staff_error', code: 'disabled' };
  }

  const roleRaw = String(account.role || meta?.staff_role || '');
  if (!isStaffRole(roleRaw)) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  let slug = meta?.restaurant_slug;
  if (!slug) {
    const { data: rest } = await supabase
      .from('restaurants_public')
      .select('slug')
      .eq('id', account.restaurant_id)
      .maybeSingle();
    slug = rest?.slug ?? undefined;
  }
  if (!slug) {
    return { kind: 'staff_error', code: 'incomplete' };
  }

  return {
    kind: 'staff',
    path: staffRolePath(slug, roleRaw),
    mustChangePassword: meta?.must_change_password === true,
  };
}

export async function resolveStaffSession(
  slug: string,
  expectedRole: StaffRole,
): Promise<StaffSessionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'unauthenticated' };

  const { data: owned } = await supabase
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (owned) {
    return { status: 'ok', role: expectedRole, slug, asOwner: true };
  }

  const meta = parseStaffUserMetadata(user.user_metadata as Record<string, unknown>);
  if (!meta || meta.restaurant_slug !== slug) {
    return { status: 'wrong_context' };
  }
  if (meta.staff_role !== expectedRole) {
    return { status: 'wrong_context' };
  }
  if (meta.must_change_password) {
    return { status: 'needs_password_change' };
  }

  const { data: account } = await supabase
    .from('restaurant_staff_accounts')
    .select('id, role, disabled_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account || account.disabled_at) {
    return { status: 'unauthenticated' };
  }
  if ((account.role as StaffAccountRole) !== expectedRole) {
    return { status: 'wrong_context' };
  }

  return { status: 'ok', role: expectedRole, slug };
}

export async function staffSignOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/** Store mode: bare login → `{login}@mesa.in`; global or input with `@` → trimmed as-is. */
export function composeStaffEmail(loginOrEmail: string, mode: 'store' | 'global'): string {
  const raw = loginOrEmail.trim().toLowerCase();
  if (mode === 'global' || raw.includes('@')) {
    return raw;
  }
  return buildStaffEmail(raw);
}
