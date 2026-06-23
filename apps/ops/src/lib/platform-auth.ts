import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type PlatformAdminAccount = {
  id: string;
  role: 'support' | 'admin';
  display_name: string;
};

export type PlatformAdminContext = {
  userId: string;
  email: string | undefined;
  account: PlatformAdminAccount;
};

export async function getPlatformAdmin(): Promise<PlatformAdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('platform_admin_accounts')
    .select('id, role, display_name')
    .eq('user_id', user.id)
    .is('disabled_at', null)
    .maybeSingle();

  if (!row) return null;

  return {
    userId: user.id,
    email: user.email,
    account: {
      id: row.id,
      role: row.role as 'support' | 'admin',
      display_name: row.display_name,
    },
  };
}

export async function requirePlatformAdmin() {
  const ctx = await getPlatformAdmin();
  if (!ctx) {
    return { ctx: null, error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }
  return { ctx, error: null, admin: createAdminClient() };
}

export async function countPlatformAdmins(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('platform_admin_accounts')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}
