import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensurePremBuiltinAdminUser } from '@/lib/auth/prem-builtin-admin';
import { isOnPremInstallHost } from '@/lib/license-on-prem-host';

export const runtime = 'nodejs';

/**
 * Install-time ensure for prem built-in admin Auth user.
 * Does not activate login (activation = claimed on_prem restaurant).
 * MESA_ON_PREM only.
 */
export async function POST() {
  if (!isOnPremInstallHost()) {
    return NextResponse.json({ error: 'not_on_prem' }, { status: 404 });
  }

  try {
    const admin = createAdminClient();
    const result = await ensurePremBuiltinAdminUser(admin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, userId: result.userId });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'ensure_failed';
    return NextResponse.json({ error: 'ensure_failed', message }, { status: 500 });
  }
}
