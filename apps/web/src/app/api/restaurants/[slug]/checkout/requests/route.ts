import { NextResponse } from 'next/server';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import {
  countCheckoutRequestsQueue,
  fetchCheckoutRequestsQueue,
} from '@/lib/checkout-requests-queue';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const countOnly = new URL(req.url).searchParams.get('count_only') === '1';

  try {
    if (countOnly) {
      const count = await countCheckoutRequestsQueue(auth.admin, auth.restaurantId);
      return NextResponse.json({ count });
    }

    const requests = await fetchCheckoutRequestsQueue(auth.admin, auth.restaurantId);
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
