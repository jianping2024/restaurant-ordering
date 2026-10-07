import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { resumeTableSessionOrdering } from '@/lib/resume-table-session-ordering';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return checkoutErrorResponse('missing_slug');
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return checkoutErrorResponse('invalid_json');
  }

  const tableId = typeof body.table_id === 'string' ? body.table_id.trim() : '';
  if (!tableId) {
    return checkoutErrorResponse('missing_table_id');
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await resumeTableSessionOrdering({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    tableId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({ ok: true });
}
