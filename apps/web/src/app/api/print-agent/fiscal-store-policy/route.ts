import { NextResponse } from 'next/server';
import { getRestaurantFiscalPolicy } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: pull Ops store policy (profile + terminal limits). ONLY store-policy read path. */
export async function GET(req: Request) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const ctx = await verifyActiveAgentBearer(req, admin);
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const policy = await getRestaurantFiscalPolicy(admin, ctx.restaurant_id);
  if (!policy) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    fiscal_profile: policy.fiscalProfile,
    max_fiscal_terminals: policy.maxFiscalTerminals,
    terminals_used: policy.terminalsUsed,
  });
}
