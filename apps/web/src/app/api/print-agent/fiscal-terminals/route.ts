import { NextResponse } from 'next/server';
import { listFiscalTerminalsForAgent } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: sync fiscal terminals from Ops. */
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

  const terminals = await listFiscalTerminalsForAgent(admin, ctx.restaurant_id);
  return NextResponse.json({
    terminals: terminals.map((t) => ({
      id: t.id,
      ops_terminal_ref: t.opsTerminalRef,
      label: t.label,
      active: t.active,
    })),
  });
}
