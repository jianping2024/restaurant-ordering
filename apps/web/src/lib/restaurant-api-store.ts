import 'server-only';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadRestaurantRefBySlug } from '@/lib/staff-gate-db';

/**
 * Store API step 1 (multi-store plan §6.1): `/api/restaurants/[slug]/…` slug → store id,
 * 404 when unknown. The id only feeds the auth gate (`requirePermission(key, storeId)` /
 * dashboard context loaders); service-role reads/writes use the id the gate returns.
 */
export async function requireStoreRestaurantId(slug: string): Promise<string | NextResponse> {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }
  const restaurant = await loadRestaurantRefBySlug(admin, slug);
  if (!restaurant) return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  return restaurant.id;
}
