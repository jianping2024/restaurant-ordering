import type { SupabaseClient } from '@supabase/supabase-js';
import { parseResolvedBuffetPriceRpcRow, type ResolvedBuffetPriceRow } from '@/lib/buffet-order';

/** Server-side buffet slot prices (same RPC as client / buffet open route). */
export async function resolveBuffetPricesServer(
  admin: SupabaseClient,
  restaurantId: string,
  buffetId: string,
  at?: string,
): Promise<ResolvedBuffetPriceRow | null> {
  const { data: priceRows, error } = await admin.rpc('resolve_buffet_prices', {
    p_restaurant_id: restaurantId,
    p_buffet_id: buffetId,
    p_at: at ?? new Date().toISOString(),
  });
  if (error) return null;
  return parseResolvedBuffetPriceRpcRow(priceRows);
}
