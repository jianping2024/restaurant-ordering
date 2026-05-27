import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  devicesNeedingRenewal,
  type PrintAgentDeviceRow,
} from '@/lib/print-agent-credential-expiry';

export const runtime = 'nodejs';

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

  const { data: rows, error } = await supabase
    .from('print_agent_devices')
    .select('id, label, valid_until, revoked_at')
    .eq('restaurant_id', restaurant.id)
    .is('revoked_at', null)
    .order('valid_until', { ascending: true });

  if (error) {
    return NextResponse.json({ error: 'query_failed', message: error.message }, { status: 500 });
  }

  const devices = devicesNeedingRenewal((rows || []) as PrintAgentDeviceRow[]);
  return NextResponse.json({ devices });
}
