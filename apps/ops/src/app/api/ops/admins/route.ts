import { NextResponse } from 'next/server';
import { fetchUserEmailsMap } from '@/lib/ops-user-lookup';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { writePlatformAudit } from '@/lib/platform-audit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { data: rows, error: listError } = await admin
    .from('platform_admin_accounts')
    .select('id, user_id, role, display_name, disabled_at, created_at')
    .order('created_at', { ascending: true });

  if (listError) {
    return NextResponse.json({ error: 'list_failed', detail: listError.message }, { status: 500 });
  }

  const userEmails = await fetchUserEmailsMap(
    admin,
    (rows || []).map((row) => row.user_id),
  );

  const items = (rows || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    email: userEmails.get(row.user_id) ?? null,
    role: row.role,
    displayName: row.display_name,
    disabledAt: row.disabled_at,
    createdAt: row.created_at,
    isSelf: row.user_id === ctx.userId,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  let body: { email?: string; password?: string; displayName?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const displayName = (body.displayName || '').trim() || 'Platform Admin';
  const role = body.role === 'admin' ? 'admin' : 'support';

  if (!EMAIL_RE.test(email) || password.length < 8) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 400 });
  }

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
      role,
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
    actorUserId: ctx.userId,
    action: 'platform_admin.create',
    targetType: 'platform_admin_account',
    targetId: accountRow.id,
    metadata: { email, role },
  });

  return NextResponse.json({ ok: true, id: accountRow.id, email, role });
}
