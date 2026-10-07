import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { fetchCheckoutRequestsQueue } from '@/lib/checkout-requests-queue';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return checkoutErrorResponse('missing_slug');
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const requests = await fetchCheckoutRequestsQueue(auth.admin, auth.restaurantId);
    return NextResponse.json({ requests });
  } catch {
    return checkoutErrorResponse('fetch_failed');
  }
}
