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
