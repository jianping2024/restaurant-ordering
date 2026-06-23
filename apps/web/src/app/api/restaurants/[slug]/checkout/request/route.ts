import { NextResponse } from 'next/server';
import { isRestaurantSuspended } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerSessionOrders } from '@/lib/customer-session-context';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { parsePortugueseNif } from '@/lib/pt-nif';
import { sumLineTotals } from '@/lib/cart-totals';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { SplitMode, SplitPerson, SplitResult } from '@/types';

export const runtime = 'nodejs';

function parseSplitMode(raw: unknown): SplitMode | null {
  if (raw === 'even' || raw === 'by_item' || raw === 'custom') return raw;
  return null;
}

function parsePersons(raw: unknown): SplitPerson[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const persons: SplitPerson[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
    if (!name) return null;
    const items = Array.isArray(r.items)
      ? r.items
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 500)
      : undefined;
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : undefined;
    persons.push({
      name,
      ...(items ? { items } : {}),
      ...(amount != null ? { amount } : {}),
    });
  }
  return persons;
}

function parseResult(raw: unknown): SplitResult[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const rows: SplitResult[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : NaN;
    if (!name || !Number.isFinite(amount) || amount < 0) return null;
    rows.push({ name, amount });
  }
  return rows;
}

function byItemAssignFromPersons(persons: SplitPerson[]): Record<string, string[]> {
  const assign: Record<string, string[]> = {};
  persons.forEach((person, personIdx) => {
    (person.items || []).forEach((key) => {
      if (!assign[key]) assign[key] = [];
      assign[key].push(`p${personIdx + 1}`);
    });
  });
  return assign;
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.json({ error: 'missing_slug' }, { status: 400 });
  }

  let body: {
    table_id?: unknown;
    split_mode?: unknown;
    persons?: unknown;
    result?: unknown;
    customer_nif?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return NextResponse.json({ error: 'invalid_table_id' }, { status: 400 });
  }

  const splitMode = parseSplitMode(body.split_mode) ?? 'custom';
  const persons = parsePersons(body.persons);
  const result = parseResult(body.result);
  if (!persons || !result) {
    return NextResponse.json({ error: 'invalid_split' }, { status: 400 });
  }

  const customerNifRaw = typeof body.customer_nif === 'string' ? body.customer_nif.trim() : '';
  const customerNif = customerNifRaw ? parsePortugueseNif(customerNifRaw) : null;
  if (customerNifRaw && !customerNif) {
    return NextResponse.json({ error: 'invalid_nif' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id, suspended_at')
    .eq('slug', slug)
    .maybeSingle();
  if (rErr || !restaurant?.id) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
  }
  if (isRestaurantSuspended(restaurant.suspended_at as string | null)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const restaurantId = restaurant.id as string;
  const { data: tableRow, error: tableErr } = await admin
    .from('restaurant_tables')
    .select('id, display_name')
    .eq('restaurant_id', restaurantId)
    .eq('id', tableId)
    .is('deleted_at', null)
    .maybeSingle();
  if (tableErr || !tableRow) {
    return NextResponse.json({ error: 'table_not_available' }, { status: 400 });
  }

  const { data: session, error: sessionErr } = await admin
    .from('table_sessions')
    .select('id, status')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sessionErr) {
    return NextResponse.json({ error: 'session_lookup_failed', message: sessionErr.message }, { status: 500 });
  }
  if (!session?.id) {
    return NextResponse.json({ error: 'no_active_session' }, { status: 404 });
  }

  const sessionId = session.id as string;
  const orders = await loadCustomerSessionOrders({
    admin,
    restaurantId,
    sessionId,
    ascending: true,
  });
  const allItems = orders.flatMap((order) =>
    order.items.map((item, idx) => ({
      ...item,
      key: `${order.id}-${idx}`,
    })),
  );
  if (allItems.length === 0) {
    return NextResponse.json({ error: 'empty_session' }, { status: 400 });
  }

  const total = sumLineTotals(allItems);
  const validation = validateBillSplit({
    splitMode,
    total,
    results: result,
    itemKeys: allItems.map((item) => item.key),
    byItemAssign: splitMode === 'by_item' ? byItemAssignFromPersons(persons) : undefined,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.issue }, { status: 400 });
  }

  const orderIds = orders.map((order) => order.id);

  const { data: rpcData, error: rpcErr } = await admin.rpc('upsert_bill_split_request', {
    p_restaurant_id: restaurantId,
    p_session_id: sessionId,
    p_table_id: tableId,
    p_display_name: tableRow.display_name as string,
    p_order_ids: orderIds,
    p_split_mode: splitMode,
    p_persons: persons,
    p_result: result,
    p_total_amount: total,
    p_customer_nif: customerNif,
  });

  if (rpcErr) {
    return NextResponse.json({ error: 'upsert_failed', message: rpcErr.message }, { status: 500 });
  }

  const payload = rpcData as {
    ok?: boolean;
    code?: string;
    message?: string;
    bill_split_id?: string;
    result?: SplitResult[];
    total_amount?: number;
  } | null;

  if (!payload?.ok) {
    const code = payload?.code ?? 'upsert_failed';
    const status =
      code === 'no_active_session' ? 404
      : code === 'invalid_request' ? 400
      : 500;
    return NextResponse.json({ error: code, message: payload?.message }, { status });
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: payload.bill_split_id,
    result: payload.result,
    total_amount: payload.total_amount ?? total,
  });
}
