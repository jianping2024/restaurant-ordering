import { NextResponse } from 'next/server';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { fetchCheckoutRequestDetail } from '@/lib/checkout-requests-queue';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: { slug: string; billSplitId: string } },
) {
  const slug = params.slug?.trim();
  const billSplitId = params.billSplitId?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }
  if (!billSplitId) {
    return NextResponse.json({ error: 'missing_bill_split_id' }, { status: 400 });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const request = await fetchCheckoutRequestDetail(auth.admin, auth.restaurantId, billSplitId);
    if (!request) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ request });
  } catch {
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
