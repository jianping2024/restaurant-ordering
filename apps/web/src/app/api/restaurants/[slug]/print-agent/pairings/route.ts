import { NextResponse } from 'next/server';
import { requireSettingsRestaurantAuth } from '@/lib/settings-restaurant-auth';
import { requireStoreRestaurantId } from '@/lib/restaurant-api-store';
import { loadPrintAgentPairings } from '@/lib/print-agent-pairings-server';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const storeId = await requireStoreRestaurantId(params.slug);
  if (storeId instanceof NextResponse) return storeId;
  const auth = await requireSettingsRestaurantAuth('settings.print_assistant.manage', storeId);
  if (auth instanceof NextResponse) return auth;

  const pairings = await loadPrintAgentPairings(auth.restaurantId);

  return NextResponse.json({
    pairings,
    pending_count: pairings.filter((p) => p.pending).length,
  });
}
