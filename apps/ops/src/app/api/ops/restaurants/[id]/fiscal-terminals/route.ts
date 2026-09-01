import { NextResponse } from 'next/server';
import { listFiscalTerminalsForAgent, revokeFiscalTerminal } from '@mesa/shared';
import { requirePlatformAdminRole } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdminRole('viewer');
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;
  const terminals = await listFiscalTerminalsForAgent(admin, restaurantId);
  return NextResponse.json({
    terminals: terminals.map((t) => ({
      id: t.id,
      ops_terminal_ref: t.opsTerminalRef,
      label: t.label,
      active: t.active,
    })),
  });
}

export async function DELETE(req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdminRole('admin');
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;
  let body: { terminal_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const terminalId = typeof body.terminal_id === 'string' ? body.terminal_id.trim() : '';
  if (!terminalId) {
    return NextResponse.json({ error: 'terminal_id_required' }, { status: 400 });
  }

  const result = await revokeFiscalTerminal(admin, { restaurantId, terminalId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, detail: result.detail }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
