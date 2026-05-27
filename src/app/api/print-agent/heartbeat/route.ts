import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

type HeartbeatBody = {
  agent_version?: string;
  mapped_station_count?: number;
  last_print_at?: string | null;
  last_print_status?: string | null;
  schedule_open?: boolean;
};

/** Agent: update device heartbeat (JWT device_id). */
export async function POST(req: Request) {
  const ctx = verifyAgentBearer(req);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: HeartbeatBody = {};
  try {
    body = (await req.json()) as HeartbeatBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const version = typeof body.agent_version === 'string' ? body.agent_version.trim().slice(0, 32) : null;
  const mapped =
    typeof body.mapped_station_count === 'number' && Number.isFinite(body.mapped_station_count)
      ? Math.max(0, Math.min(99, Math.floor(body.mapped_station_count)))
      : null;

  let lastPrintAt: string | null = null;
  if (body.last_print_at) {
    const t = new Date(body.last_print_at);
    if (!Number.isNaN(t.getTime())) {
      lastPrintAt = t.toISOString();
    }
  }

  let lastPrintStatus: string | null = null;
  if (body.last_print_status === 'done' || body.last_print_status === 'failed') {
    lastPrintStatus = body.last_print_status;
  }

  const scheduleOpen = body.schedule_open === true;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    last_seen: nowIso,
    schedule_open: scheduleOpen,
  };
  if (version) patch.agent_version = version;
  if (mapped !== null) patch.mapped_station_count = mapped;
  if (lastPrintAt) patch.last_print_at = lastPrintAt;
  if (lastPrintStatus) patch.last_print_status = lastPrintStatus;

  const { data: row, error } = await admin
    .from('print_agent_devices')
    .update(patch)
    .eq('id', ctx.device_id)
    .eq('restaurant_id', ctx.restaurant_id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'device_not_found_or_revoked' }, { status: 403 });
  }

  return NextResponse.json({ status: 'ok', last_seen: nowIso });
}
