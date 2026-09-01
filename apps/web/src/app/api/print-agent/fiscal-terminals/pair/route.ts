import { NextResponse } from 'next/server';
import { pairFiscalTerminalWithCode } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyActiveAgentBearer } from '@/lib/print-agent-auth';

export const runtime = 'nodejs';

/** Agent: redeem Ops fiscal terminal pairing code. ONLY terminal pair write path. */
export async function POST(req: Request) {
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

  let body: { pairing_code?: string; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const pairingCode = typeof body.pairing_code === 'string' ? body.pairing_code : '';
  if (!pairingCode) {
    return NextResponse.json({ error: 'pairing_code_required' }, { status: 400 });
  }

  const result = await pairFiscalTerminalWithCode(admin, {
    restaurantId: ctx.restaurant_id,
    pairingCode,
    label: typeof body.label === 'string' ? body.label : undefined,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status });
  }

  return NextResponse.json({
    terminal_id: result.terminalId,
    ops_terminal_ref: result.opsTerminalRef,
    label: result.label,
  });
}
