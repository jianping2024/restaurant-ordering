import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { countPlatformAdmins } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

export async function POST(req: Request) {
  const expected = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  let body: {
    adminSecret?: string;
    email?: string;
    password?: string;
    displayName?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const adminSecret = body.adminSecret || '';
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const displayName = (body.displayName || '').trim() || 'Platform Admin';

  if (adminSecret !== expected) {
    return NextResponse.json({ error: 'invalid_secret' }, { status: 403 });
  }

  const existing = await countPlatformAdmins();
  if (existing > 0) {
    return NextResponse.json({ error: 'bootstrap_already_done' }, { status: 409 });
  }

  if (!email || password.length < 8) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !userData.user) {
    return NextResponse.json(
      { error: 'create_user_failed', detail: createError?.message },
      { status: 400 },
    );
  }

  const userId = userData.user.id;
  const { data: accountRow, error: insertError } = await admin
    .from('platform_admin_accounts')
    .insert({
      user_id: userId,
      role: 'admin',
      display_name: displayName,
    })
    .select('id')
    .single();

  if (insertError || !accountRow) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: 'account_insert_failed', detail: insertError?.message },
      { status: 500 },
    );
  }

  await writePlatformAudit(admin, {
    actorUserId: userId,
    action: 'ops.bootstrap_admin',
    targetType: 'platform_admin_account',
    targetId: accountRow.id,
    metadata: { email },
  });

  return NextResponse.json({ ok: true, email });
}
