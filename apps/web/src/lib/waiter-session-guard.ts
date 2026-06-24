import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/** True when the table's active session is in billing (guest requested checkout). */
export async function tableSessionBlocksWaiterMutation(
  admin: SupabaseClient,
  restaurantId: string,
  tableId: string,
): Promise<boolean> {
  const { data: session } = await admin
    .from('table_sessions')
    .select('status')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return session?.status === 'billing';
}

/** True when a session row is in billing. */
export async function sessionIdBlocksWaiterMutation(
  admin: SupabaseClient,
  sessionId: string,
): Promise<boolean> {
  const { data: session } = await admin
    .from('table_sessions')
    .select('status')
    .eq('id', sessionId)
    .maybeSingle();

  return session?.status === 'billing';
}

export function sessionBillingResponse() {
  return NextResponse.json({ error: 'session_billing' }, { status: 409 });
}
