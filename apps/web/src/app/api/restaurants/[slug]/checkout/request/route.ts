import { NextResponse } from 'next/server';
import { checkoutErrorResponse } from '@/lib/checkout-error-response';
import { assertCheckoutRequestAllowed } from '@/lib/checkout-request-auth';
import { AUDIT_EVENT, loadStaffAuditActor, scheduleRecordAudit } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadCustomerRestaurantForApi } from '@/lib/customer-restaurant-gate';
import { submitCheckoutRequestForTable } from '@/lib/checkout-request-server';
import {
  submitIndividualCall,
} from '@/lib/individual-checkout-server';
import { parseGuestClientId } from '@/lib/table-order-round/guest-client';
import { parseSplitMode } from '@/lib/checkout-split-intent';
import { parsePortugueseNif } from '@/lib/pt-nif';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { parseOptionalUnitDen } from '@/lib/by-item-fraction-unit';
import { parseOptionalPartyIdFromRow } from '@/lib/split-party-id';
import type { SplitPerson, SplitPersonItemShare, SplitResult } from '@/types';

export const runtime = 'nodejs';

function parsePersonItemShare(entry: unknown): SplitPersonItemShare | null {
  if (!entry || typeof entry !== 'object') return null;
  const share = entry as Record<string, unknown>;
  const key = typeof share.key === 'string' ? share.key.trim() : '';
  const party_id = parseOptionalPartyIdFromRow(share);
  const guest_type =
    share.guest_type === 'adult' || share.guest_type === 'child'
      ? share.guest_type
      : undefined;
  const qty_unit_den = parseOptionalUnitDen(share.qty_unit_den);
  const lockedRaw = share.locked_amount;
  const locked_amount =
    typeof lockedRaw === 'number' && Number.isFinite(lockedRaw) && lockedRaw >= 0
      ? Math.round(lockedRaw * 100) / 100
      : undefined;
  if (guest_type) {
    if (!key) return null;
    const qty_num = typeof share.qty_num === 'number' && Number.isFinite(share.qty_num)
      ? Math.trunc(share.qty_num)
      : 1;
    const qty_den = typeof share.qty_den === 'number' && Number.isFinite(share.qty_den)
      ? Math.trunc(share.qty_den)
      : 1;
    if (qty_den <= 0 || qty_num <= 0) return null;
    return {
      key,
      qty_num,
      qty_den,
      guest_type,
      ...(party_id ? { party_id } : {}),
      ...(locked_amount != null ? { locked_amount } : {}),
    };
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
  return {
    key,
    qty_num,
    qty_den,
    ...(qty_unit_den ? { qty_unit_den } : {}),
    ...(party_id ? { party_id } : {}),
    ...(locked_amount != null ? { locked_amount } : {}),
  };
}

function parsePersons(raw: unknown): SplitPerson[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const persons: SplitPerson[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 80) : '';
    if (!name) return null;
    const party_id = parseOptionalPartyIdFromRow(r);
    const items = Array.isArray(r.items)
      ? r.items
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
          .slice(0, 500)
      : undefined;
    const item_shares = Array.isArray(r.item_shares)
      ? r.item_shares
          .map(parsePersonItemShare)
          .filter((entry): entry is SplitPersonItemShare => entry != null)
          .slice(0, 500)
      : undefined;
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? r.amount : undefined;
    persons.push({
      name,
      ...(party_id ? { party_id } : {}),
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
    const party_id = parseOptionalPartyIdFromRow(r);
    rows.push({ name, amount, ...(party_id ? { party_id } : {}) });
  }
  return rows;
}

export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  const slug = params.slug?.trim();
  if (!slug) {
    return checkoutErrorResponse('missing_slug');
  }

  let body: {
    table_id?: unknown;
    split_mode?: unknown;
    persons?: unknown;
    result?: unknown;
    customer_nif?: unknown;
    allow_partial_by_item?: unknown;
    guest_client_id?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return checkoutErrorResponse('invalid_json');
  }

  const auth = await assertCheckoutRequestAllowed(slug, {
    guestClientId: body.guest_client_id,
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { caller } = auth;

  const tableId = parseTableIdParam(body.table_id);
  if (!tableId) {
    return checkoutErrorResponse('invalid_table_id');
  }

  // Absent → whole table; an unknown value (e.g. removed `custom`) is rejected, never coerced.
  const splitMode =
    body.split_mode == null ? 'whole_table' : parseSplitMode(body.split_mode);
  if (!splitMode) {
    return checkoutErrorResponse('invalid_split_mode');
  }
  const persons = parsePersons(body.persons);
  const result = parseResult(body.result);
  if (!persons || !result) {
    return checkoutErrorResponse('invalid_split');
  }

  const customerNifRaw = typeof body.customer_nif === 'string' ? body.customer_nif.trim() : '';
  const customerNif = customerNifRaw ? parsePortugueseNif(customerNifRaw) : null;
  if (customerNifRaw && !customerNif) {
    return checkoutErrorResponse('invalid_nif');
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return checkoutErrorResponse('server_misconfigured');
  }

  const loaded = await loadCustomerRestaurantForApi(admin, slug);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }

  // Guest phone: by-item → one ticket; whole_table / even → shared table plan.
  // quick_table_close only swaps staff floor「呼叫结账」→「关台结账」; guests stay allowed.
  if (caller.kind === 'customer') {
    const guestClientId = parseGuestClientId(body.guest_client_id);
    if (!guestClientId) {
      return checkoutErrorResponse('invalid_guest_client_id');
    }
    if (splitMode === 'by_item') {
      const individual = await submitIndividualCall(admin, {
        restaurantId: loaded.restaurant.id,
        tableId,
        clientId: guestClientId,
        persons,
        result,
      });
      if (!individual.ok) {
        return NextResponse.json(
          {
            error: individual.error,
            message: individual.message,
            line_keys: individual.lineKeys,
            names: individual.names,
          },
          { status: individual.status },
        );
      }
      return NextResponse.json({
        ok: true,
        bill_split_id: individual.bill_split_id,
        session_id: individual.session_id,
        result: individual.result,
        total_amount: individual.total_amount,
      });
    }
    if (splitMode !== 'whole_table' && splitMode !== 'even') {
      return checkoutErrorResponse('invalid_split_mode');
    }
    const submitResult = await submitCheckoutRequestForTable(
      admin,
      loaded.restaurant.id,
      tableId,
      { splitMode, persons, result, customerNif },
      { allowPartialByItem: false },
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
      session_id: submitResult.session_id,
      result: submitResult.result,
      total_amount: submitResult.total_amount,
    });
  }

  const allowPartialByItem =
    body.allow_partial_by_item === true && caller.kind === 'authorized_staff';

  const submitResult = await submitCheckoutRequestForTable(
    admin,
    loaded.restaurant.id,
    tableId,
    { splitMode, persons, result, customerNif },
    { allowPartialByItem },
  );

  if (!submitResult.ok) {
    return NextResponse.json(
      {
        error: submitResult.error,
        message: submitResult.message,
        line_keys: submitResult.lineKeys,
      },
      { status: submitResult.status },
    );
  }

  if (caller.kind === 'authorized_staff') {
    const { staffSessionForSlug } = await import('@/lib/staff-api-auth');
    const staffCtx = await staffSessionForSlug(slug);
    if (staffCtx) {
      const actor = await loadStaffAuditActor(admin, {
        restaurantId: loaded.restaurant.id,
        userId: staffCtx.user_id,
        role: staffCtx.role,
      });
      scheduleRecordAudit(admin, AUDIT_EVENT.CHECKOUT_REQUESTED, {
        restaurantId: loaded.restaurant.id,
        actor,
        context: {
          billSplitId: submitResult.bill_split_id,
          sessionId: submitResult.session_id,
          tableName: submitResult.table_name || '—',
          splitMode: submitResult.split_mode,
          totalAmount: submitResult.total_amount,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    bill_split_id: submitResult.bill_split_id,
    session_id: submitResult.session_id,
    result: submitResult.result,
    total_amount: submitResult.total_amount,
  });
}
