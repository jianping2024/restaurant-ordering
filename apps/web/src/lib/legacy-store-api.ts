import 'server-only';

import { NextResponse } from 'next/server';
import { listAuthorizedRestaurantsForUser } from '@/lib/permissions/restaurant-access';
import { pickLandingRestaurant } from '@/lib/permissions/restaurant-access-rules';
import { loadAuthUserWithAdmin } from '@/lib/staff-access';


/**
 * Rollback compatibility (multi-store plan §5.4): store-less `/api/dashboard/**`,
 * `/api/restaurant/**`, `/api/analytics/**` stay **one release** for pages still open
 * across the deploy. They call the same `/api/restaurants/[slug]/…` handler with the
 * account's only enterable store — no copied logic. A multi-store account has no implied
 * store (pages before the deploy were single-store): 409 `store_required`.
 */
export function legacyStoreApi<P extends { slug: string }>(
  handler: (req: Request, ctx: { params: P }) => Promise<Response>,
) {
  return async (req: Request, ctx?: { params?: Record<string, string> }): Promise<Response> => {
    const auth = await loadAuthUserWithAdmin();
    if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const decision = pickLandingRestaurant(await listAuthorizedRestaurantsForUser(auth.user.id));
    if (decision.kind === 'select') {
      return NextResponse.json({ error: 'store_required' }, { status: 409 });
    }
    if (decision.kind !== 'store') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const { slug } = decision.restaurant;
    return handler(req, { params: { ...(ctx?.params ?? {}), slug } as unknown as P });
  };
}
