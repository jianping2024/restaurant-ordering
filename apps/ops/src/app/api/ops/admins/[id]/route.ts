import { NextResponse } from 'next/server';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { kickStaffUserSessions, setStaffUserBanned } from '@/lib/staff-account-actions';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id } = await context.params;

  let body: { action?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { data: account, error: fetchError } = await admin
    .from('platform_admin_accounts')
    .select('id, user_id, role, display_name, disabled_at')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const action = body.action;

  if (action === 'disable') {
    if (account.user_id === ctx.userId) {
      return NextResponse.json({ error: 'cannot_disable_self' }, { status: 409 });
    }
    if (account.disabled_at) {
      return NextResponse.json({ error: 'already_disabled' }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('platform_admin_accounts')
      .update({ disabled_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
    }

    await setStaffUserBanned(admin, account.user_id, true);
    await kickStaffUserSessions(admin, account.user_id);

    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'platform_admin.disable',
      targetType: 'platform_admin_account',
      targetId: account.id,
      metadata: { displayName: account.display_name },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'enable') {
    if (!account.disabled_at) {
      return NextResponse.json({ error: 'not_disabled' }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('platform_admin_accounts')
      .update({ disabled_at: null })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
    }

    await setStaffUserBanned(admin, account.user_id, false);

    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'platform_admin.enable',
      targetType: 'platform_admin_account',
      targetId: account.id,
      metadata: { displayName: account.display_name },
    });

    return NextResponse.json({ ok: true });
  }

  if (body.role === 'admin' || body.role === 'support') {
    if (account.user_id === ctx.userId && body.role !== account.role) {
      return NextResponse.json({ error: 'cannot_change_own_role' }, { status: 409 });
    }
    if (body.role === account.role) {
      return NextResponse.json({ ok: true, role: account.role });
    }

    const { error: updateError } = await admin
      .from('platform_admin_accounts')
      .update({ role: body.role })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
    }

    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'platform_admin.role_change',
      targetType: 'platform_admin_account',
      targetId: account.id,
      metadata: { from: account.role, to: body.role },
    });

    return NextResponse.json({ ok: true, role: body.role });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
