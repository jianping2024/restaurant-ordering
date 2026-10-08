import { NextResponse } from 'next/server';
import { authorizeCheckoutConfirmPayment } from '@/lib/checkout-confirm-payment-auth';
import { checkoutErrorStatus } from '@/lib/checkout-error-codes';
import {
  logCheckoutResumeFailure,
  type CheckoutResumeFailureLogFields,
} from '@/lib/checkout-resume-failure-log';
import { resumeTableSessionOrdering } from '@/lib/resume-table-session-ordering';

export const runtime = 'nodejs';

/** Sole API failure exit: one structured log line, then JSON error body. */
function respondCheckoutResumeFailure(
  fields: Omit<CheckoutResumeFailureLogFields, 'stage'> & { status: number },
): NextResponse {
  logCheckoutResumeFailure({ stage: 'api', ...fields });
  return NextResponse.json(
    {
      error: fields.error,
      ...(fields.message !== undefined ? { message: fields.message } : {}),
    },
    { status: fields.status },
  );
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim() ?? '';
  if (!slug) {
    return respondCheckoutResumeFailure({
      error: 'missing_slug',
      status: checkoutErrorStatus('missing_slug'),
    });
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return respondCheckoutResumeFailure({
      slug,
      error: 'invalid_json',
      status: checkoutErrorStatus('invalid_json'),
    });
  }

  const tableId = typeof body.table_id === 'string' ? body.table_id.trim() : '';
  if (!tableId) {
    return respondCheckoutResumeFailure({
      slug,
      error: 'missing_table_id',
      status: checkoutErrorStatus('missing_table_id'),
    });
  }

  const auth = await authorizeCheckoutConfirmPayment(slug, req);
  if ('error' in auth) {
    return respondCheckoutResumeFailure({
      slug,
      table_id: tableId,
      error: auth.error,
      status: auth.status,
    });
  }

  const result = await resumeTableSessionOrdering({
    admin: auth.admin,
    restaurantId: auth.restaurantId,
    tableId,
  });

  if (!result.ok) {
    return respondCheckoutResumeFailure({
      slug,
      restaurant_id: auth.restaurantId,
      table_id: tableId,
      operator_name: auth.actor.displayName,
      error: result.code,
      status: result.status,
      message: result.message,
    });
  }

  return NextResponse.json({ ok: true });
}
