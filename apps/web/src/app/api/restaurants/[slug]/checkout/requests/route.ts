import { NextResponse } from 'next/server';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { fetchCheckoutRequestsQueue } from '@/lib/checkout-requests-queue';

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

  try {
    const requests = await fetchCheckoutRequestsQueue(auth.admin, auth.restaurantId);
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
