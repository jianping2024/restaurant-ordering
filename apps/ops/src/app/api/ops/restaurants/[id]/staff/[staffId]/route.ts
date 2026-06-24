import { NextResponse } from 'next/server';
import { requirePlatformAdminRole } from '@/lib/platform-auth';
import { kickStaffUserSessions, setStaffUserBanned } from '@/lib/staff-account-actions';
import { writePlatformAudit } from '@/lib/platform-audit';

type RouteContext = { params: Promise<{ id: string; staffId: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const { ctx, error, admin } = await requirePlatformAdminRole('admin');
  if (error || !ctx || !admin) return error!;

  const { id: restaurantId, staffId } = await context.params;

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { data: staff, error: fetchError } = await admin
    .from('restaurant_staff_accounts')
    .select('id, user_id, restaurant_id, role, display_name, login_name, disabled_at')
    .eq('id', staffId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: 'fetch_failed', detail: fetchError.message }, { status: 500 });
  }
  if (!staff) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const action = body.action;

  if (action === 'disable') {
    if (staff.disabled_at) {
      return NextResponse.json({ error: 'already_disabled' }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', staffId);

    if (updateError) {
      return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
    }

    await setStaffUserBanned(admin, staff.user_id, true);
    await kickStaffUserSessions(admin, staff.user_id);

    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'staff.disable',
      targetType: 'restaurant_staff_account',
      targetId: staff.id,
      restaurantId,
      metadata: { loginName: staff.login_name, role: staff.role },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === 'enable') {
    if (!staff.disabled_at) {
      return NextResponse.json({ error: 'not_disabled' }, { status: 409 });
    }

    const { error: updateError } = await admin
      .from('restaurant_staff_accounts')
      .update({ disabled_at: null, updated_at: new Date().toISOString() })
      .eq('id', staffId);

    if (updateError) {
      return NextResponse.json({ error: 'update_failed', detail: updateError.message }, { status: 500 });
    }

    await setStaffUserBanned(admin, staff.user_id, false);

    await writePlatformAudit(admin, {
      actorUserId: ctx.userId,
      action: 'staff.enable',
      targetType: 'restaurant_staff_account',
      targetId: staff.id,
      restaurantId,
      metadata: { loginName: staff.login_name, role: staff.role },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}
