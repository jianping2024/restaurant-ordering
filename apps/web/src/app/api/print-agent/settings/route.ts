import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  cloudConfigToForm,
  defaultPrintAgentCloudConfig,
  normalizePrintAgentCloudConfig,
  validatePrintAgentCloudConfig,
} from '@/lib/print-agent-config';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await getOwnerRestaurantId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', auth.restaurantId)
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
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const validated = validatePrintAgentCloudConfig(body);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { error } = await admin
    .from('restaurants')
    .update({ print_agent_config: validated.config })
    .eq('id', auth.restaurantId);

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    config: validated.config,
    form: cloudConfigToForm(validated.config),
  });
}
