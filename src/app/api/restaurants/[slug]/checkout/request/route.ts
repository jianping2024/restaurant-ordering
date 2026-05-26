import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateBillSplit } from '@/lib/bill-split-validate';
import { sumLineTotals } from '@/lib/cart-totals';
import { mergeSplitResultPaid } from '@/lib/checkout-request-state';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { Order, SplitMode, SplitPerson, SplitResult } from '@/types';

export const runtime = 'nodejs';

const AMOUNT_EPS = 0.009;

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

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: restaurant, error: rErr } = await admin
    .from('restaurants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (rErr || !restaurant?.id) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 });
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
  const { data: orderRows, error: ordersErr } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (ordersErr) {
    return NextResponse.json({ error: 'orders_lookup_failed', message: ordersErr.message }, { status: 500 });
  }

  const orders = (orderRows || []) as Order[];
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

  const resultTotal = result.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (Math.abs(resultTotal - total) > AMOUNT_EPS) {
    return NextResponse.json({ error: 'amount_mismatch' }, { status: 400 });
  }

  const { data: existingRequest, error: existingErr } = await admin
    .from('bill_splits')
    .select('id, result')
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed', 'requested'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingErr) {
    return NextResponse.json({ error: 'request_lookup_failed', message: existingErr.message }, { status: 500 });
  }

  const orderIds = orders.map((order) => order.id);
  const nextResult = existingRequest?.result
    ? mergeSplitResultPaid(result, existingRequest.result as SplitResult[])
    : result;
  const payload = {
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: tableRow.display_name as string,
    order_ids: orderIds,
    split_mode: splitMode,
    persons,
    result: nextResult,
    total_amount: total,
    status: 'requested' as const,
  };

  let billSplitId: string;
  if (existingRequest?.id) {
    const { error: updateErr } = await admin
      .from('bill_splits')
      .update(payload)
      .eq('id', existingRequest.id);
    if (updateErr) {
      return NextResponse.json({ error: 'request_update_failed', message: updateErr.message }, { status: 500 });
    }
    billSplitId = existingRequest.id as string;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from('bill_splits')
      .insert(payload)
      .select('id')
      .single();
    if (insertErr || !inserted?.id) {
      return NextResponse.json({ error: 'request_insert_failed', message: insertErr?.message }, { status: 500 });
    }
    billSplitId = inserted.id as string;
  }

  const { error: billingErr } = await admin
    .from('table_sessions')
    .update({ status: 'billing' })
    .eq('id', sessionId)
    .in('status', ['open', 'billing']);
  if (billingErr) {
    return NextResponse.json({ error: 'session_billing_failed', message: billingErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: billSplitId,
    result: nextResult,
    total_amount: total,
  });
}
