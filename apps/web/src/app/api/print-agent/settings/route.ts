import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  normalizePrintAgentCloudConfig,
  parsePrintAgentSchedulePollSlice,
} from '@/lib/print-agent-config';
import { mergeAndPersistPrintAgentConfig } from '@/lib/print-agent-config-patch-server';
import { isRestaurantSuspended } from '@mesa/shared';
import { requirePermission } from '@/lib/permissions/require';
import type { PermissionKey } from '@/lib/permissions/registry';

export const runtime = 'nodejs';

export async function GET() {
  const permission: PermissionKey = 'settings.print_assistant.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', auth.principal.restaurantId)
    .single();

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const raw = row?.print_agent_config;
  const config =
    raw && typeof raw === 'object' && Object.keys(raw as object).length > 0
      ? normalizePrintAgentCloudConfig(raw)
      : defaultPrintAgentCloudConfig();

  return NextResponse.json({
    config,
    form: cloudConfigToForm(config),
  });
}

export async function PUT(req: Request) {
  const permission: PermissionKey = 'settings.print_assistant.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: suspendedReadErr } = await admin
    .from('restaurants')
    .select('suspended_at')
    .eq('id', auth.principal.restaurantId)
    .maybeSingle();
  if (suspendedReadErr || !row) {
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (row.suspended_at && isRestaurantSuspended(row.suspended_at)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const parsed = parsePrintAgentSchedulePollSlice(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await mergeAndPersistPrintAgentConfig(admin, auth.principal.restaurantId, {
    schedule: parsed.slice.schedule,
    poll: parsed.slice.poll,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.error === 'query_failed' ? 500 : 500 },
    );
  }

  return NextResponse.json({
    config: result.config,
    form: cloudConfigToForm(result.config),
  });
}
