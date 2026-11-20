import 'server-only';

import { NextResponse } from 'next/server';
import { pickEnterableStore } from '@/lib/dashboard-entry';
import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';


/**
 * Rollback compatibility (multi-store plan §5.4): store-less `/api/dashboard/**`,
 * `/api/restaurant/**`, `/api/analytics/**` stay **one release** for pages still open
 * across the deploy. They call the same `/api/restaurants/[slug]/…` handler with the
 * account's store (batch 1: one store each) — no copied logic. Removed in batch 2.
 */
export function legacyStoreApi<P extends { slug: string }>(
  handler: (req: Request, ctx: { params: P }) => Promise<Response>,
) {
  return async (req: Request, ctx?: { params?: Record<string, string> }): Promise<Response> => {
    const auth = await loadAuthUserWithAdmin();
    if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const store = pickEnterableStore(await listAuthorizedRestaurantsForUser(auth.user.id));
    if (!store) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return handler(req, { params: { ...(ctx?.params ?? {}), slug: store.slug } as unknown as P });
  };
}
