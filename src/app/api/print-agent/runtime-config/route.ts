import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { defaultPrintAgentCloudConfig, normalizePrintAgentCloudConfig } from '@/lib/print-agent-config';
import { verifyAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent pulls once at startup (Bearer JWT). Overrides local schedule + poll only. */
export async function GET(req: Request) {
  const ctx = verifyAgentBearer(req);
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
    .single();

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const raw = row?.print_agent_config;
  const config =
    raw && typeof raw === 'object' && Object.keys(raw as object).length > 0
      ? normalizePrintAgentCloudConfig(raw)
      : defaultPrintAgentCloudConfig();

  return NextResponse.json(config);
}
