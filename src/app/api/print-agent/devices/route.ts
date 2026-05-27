import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loadPrintAgentDevices } from '@/lib/print-agent-devices-server';

export const runtime = 'nodejs';

/** Owner: paired print agents with heartbeat fields for Dashboard. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const devices = await loadPrintAgentDevices(restaurant.id);
  return NextResponse.json({ devices });
}
