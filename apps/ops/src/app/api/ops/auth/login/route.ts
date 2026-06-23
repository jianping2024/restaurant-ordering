import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { writePlatformAudit } from '@/lib/platform-audit';

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  if (!email || !password) {
    return NextResponse.json({ error: 'credentials_required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: account } = await admin
    .from('platform_admin_accounts')
    .select('id')
    .eq('user_id', data.user.id)
    .is('disabled_at', null)
    .maybeSingle();

  if (!account) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: 'not_platform_admin' }, { status: 403 });
  }

  await writePlatformAudit(admin, {
    actorUserId: data.user.id,
    action: 'ops.login',
    targetType: 'platform_admin_account',
    targetId: account.id,
  });

  return NextResponse.json({ ok: true });
}
