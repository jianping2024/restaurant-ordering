import { NextResponse } from 'next/server';
import { loadFrontdeskOperationalContext } from '@/lib/dashboard-access';
import { submitWholeTableCheckoutRequest } from '@/lib/checkout-request-server';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export const runtime = 'nodejs';

const WHOLE_TABLE_PAYER_LABEL = '整桌';

export async function POST(req: Request) {
  const ctx = await loadFrontdeskOperationalContext({ requireWritable: true });
  if ('error' in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let body: { table_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const result = await submitWholeTableCheckoutRequest(
    ctx.admin,
    ctx.restaurantId,
    tableId,
    WHOLE_TABLE_PAYER_LABEL,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, message: result.message },
      { status: result.status },
    );
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: result.bill_split_id,
    result: result.result,
    total_amount: result.total_amount,
  });
}
