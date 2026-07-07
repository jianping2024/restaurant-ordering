import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadPrintAgentPairings } from '@/lib/print-agent-pairings-server';

export const runtime = 'nodejs';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const pairings = await loadPrintAgentPairings();

  return NextResponse.json({
    pairings,
    pending_count: pairings.filter((p) => p.pending).length,
  });
}
