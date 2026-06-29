import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-session-context';
import { submitCheckoutRequestForTable } from '@/lib/checkout-request-server';
import { parsePortugueseNif } from '@/lib/pt-nif';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import type { SplitMode, SplitPerson, SplitPersonItemShare, SplitResult } from '@/types';

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
    const item_shares = Array.isArray(r.item_shares)
      ? r.item_shares
          .map((entry): SplitPersonItemShare | null => {
            if (!entry || typeof entry !== 'object') return null;
            const share = entry as Record<string, unknown>;
            const key = typeof share.key === 'string' ? share.key.trim() : '';
            const guest_type =
              share.guest_type === 'adult' || share.guest_type === 'child'
                ? share.guest_type
                : undefined;
            if (guest_type) {
              if (!key) return null;
              return { key, qty_num: 1, qty_den: 1, guest_type };
            }
            const qty_num = typeof share.qty_num === 'number' && Number.isFinite(share.qty_num)
              ? Math.trunc(share.qty_num)
              : NaN;
            const qty_den = typeof share.qty_den === 'number' && Number.isFinite(share.qty_den)
              ? Math.trunc(share.qty_den)
              : NaN;
            if (!key || !Number.isFinite(qty_num) || !Number.isFinite(qty_den) || qty_den <= 0 || qty_num <= 0) {
              return null;
            }
            return { key, qty_num, qty_den };
          })
          .filter((entry): entry is SplitPersonItemShare => entry != null)
          .slice(0, 500)
      : undefined;
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : undefined;
    persons.push({
      name,
      ...(items?.length ? { items } : {}),
      ...(item_shares?.length ? { item_shares } : {}),
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

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  const submitResult = await submitCheckoutRequestForTable(
    admin,
    loaded.restaurant.id,
    tableId,
    { splitMode, persons, result, customerNif },
  );

  if (!submitResult.ok) {
    return NextResponse.json(
      { error: submitResult.error, message: submitResult.message },
      { status: submitResult.status },
    );
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: submitResult.bill_split_id,
    result: submitResult.result,
    total_amount: submitResult.total_amount,
  });
}
