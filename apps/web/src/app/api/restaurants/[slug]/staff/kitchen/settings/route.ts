import { NextResponse } from 'next/server';
import { staffAuthFromRequest } from '@/lib/staff-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { mergeStoredPrintAgentConfig } from '@/lib/print-agent-config-patch-server';
import {
  kitchenReadyAfterMinutesFromConfig,
  parseKitchenReadyAfterMinutesPatch,
  resolveKitchenReadyAfterMinutes,
} from '@/lib/print-agent-config';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'floor.kitchen_board.view');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
    .eq('id', ctx.restaurant_id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  return NextResponse.json({
    kitchen_ready_after_minutes: kitchenReadyAfterMinutesFromConfig(row.print_agent_config),
  });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const slug = params.slug;
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const ctx = await staffAuthFromRequest(req, slug, 'floor.kitchen_board.view');
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const minutes = parseKitchenReadyAfterMinutesPatch(body);
  if (minutes === undefined) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (minutes === null) {
    return NextResponse.json({ error: 'invalid_kitchen_ready_after_minutes' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select('print_agent_config')
    .eq('id', ctx.restaurant_id)
    .maybeSingle();

  if (readError || !row) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }

  const nextConfig = mergeStoredPrintAgentConfig(row.print_agent_config, {
    kitchen_ready_after_minutes: resolveKitchenReadyAfterMinutes(minutes),
  });

  const { error: updateError } = await admin
    .from('restaurants')
    .update({ print_agent_config: nextConfig })
    .eq('id', ctx.restaurant_id);

  if (updateError) {
    return NextResponse.json(
      { error: 'update_failed', message: updateError.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    kitchen_ready_after_minutes: kitchenReadyAfterMinutesFromConfig(nextConfig),
  });
}
