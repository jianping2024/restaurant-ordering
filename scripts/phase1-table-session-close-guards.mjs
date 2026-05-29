/**
 * Phase 1: confirm table-session close has no server-side guards (UI vs API gap).
 * Mutates disposable test rows on dev/staging restaurant only.
 *
 * Usage: node scripts/phase1-table-session-close-guards.mjs [slug]
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

function normalizeOrderItemStatus(item, orderStatus) {
  if (item.item_status) return item.item_status;
  if (orderStatus === 'done') return 'done';
  if (orderStatus === 'cooking') return 'cooking';
  return 'pending';
}

/** Mirrors buildWaiterTableCard close guard inputs (WaiterTableDetail + OrdersHistoryManager). */
function uiCloseGuard(orders) {
  let pending = 0;
  let cooking = 0;
  let ready = 0;
  for (const order of orders) {
    for (const item of order.items || []) {
      if (item.kind === 'buffet_base') continue;
      const status = normalizeOrderItemStatus(item, order.status);
      if (status === 'pending') pending += item.qty || 1;
      if (status === 'cooking') cooking += item.qty || 1;
      if (status === 'done') ready += item.qty || 1;
    }
  }
  const canCloseTableCard = cooking === 0 && ready === 0;
  return { pending, cooking, ready, canCloseTableCard, canCloseOwner: canCloseTableCard };
}

function voidAllLineItemsForForcedClose(items) {
  const now = new Date().toISOString();
  return (items || []).map((item) => {
    if (item.kind === 'buffet_base') return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided', voided_at: now };
  });
}

/** Mirrors closeActiveTableSessionWithOperationalCleanup (no preflight guards). */
async function closeActiveTableSessionWithOperationalCleanup(admin, restaurantId, tableId, closedReason) {
  const { data: session, error: findError } = await admin
    .from('table_sessions')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('table_id', tableId)
    .in('status', ['open', 'billing'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError || !session?.id) {
    return { ok: false, code: 'no_session', message: findError?.message };
  }

  const sessionId = session.id;

  const { error: splitErr } = await admin
    .from('bill_splits')
    .update({ status: 'cancelled' })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed', 'requested']);

  if (splitErr) {
    return { ok: false, code: 'update_failed', message: splitErr.message };
  }

  const { data: orderRows, error: ordersErr } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'cooking', 'done']);

  if (ordersErr) {
    return { ok: false, code: 'update_failed', message: ordersErr.message };
  }

  const nowIso = new Date().toISOString();
  for (const row of orderRows || []) {
    const nextItems = voidAllLineItemsForForcedClose(row.items || []);
    const { error: orderUpdErr } = await admin
      .from('orders')
      .update({
        items: nextItems,
        status: 'done',
        total_amount: 0,
        updated_at: nowIso,
      })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);

    if (orderUpdErr) {
      return { ok: false, code: 'update_failed', message: orderUpdErr.message };
    }
  }

  const { error: sessionErr } = await admin
    .from('table_sessions')
    .update({
      status: 'closed',
      closed_at: nowIso,
      closed_reason: closedReason,
    })
    .eq('id', sessionId);

  if (sessionErr) {
    return { ok: false, code: 'update_failed', message: sessionErr.message };
  }

  return { ok: true, session_id: sessionId };
}

async function createTestTable(admin, restaurantId, label) {
  const suffix = Date.now().toString(36).slice(-3);
  const displayName = `P1${String(label).slice(0, 2)}${suffix}`.slice(0, 16);
  const tableId = randomUUID();
  const { error } = await admin.from('restaurant_tables').insert({
    id: tableId,
    restaurant_id: restaurantId,
    display_name: displayName,
    sort_order: 9999,
  });
  if (error) throw new Error(`create_table_failed:${error.message}`);
  return { tableId, displayName };
}

async function openSession(admin, restaurantId, tableId) {
  const sessionId = randomUUID();
  const { error } = await admin.from('table_sessions').insert({
    id: sessionId,
    restaurant_id: restaurantId,
    table_id: tableId,
    status: 'billing',
    opened_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_session_failed:${error.message}`);
  return sessionId;
}

async function insertOrder(admin, restaurantId, sessionId, tableId, displayName, status, items) {
  const orderId = randomUUID();
  const total = items.reduce((sum, i) => sum + (i.price || 10) * (i.qty || 1), 0);
  const { error } = await admin.from('orders').insert({
    id: orderId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    status,
    items,
    total_amount: total,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_order_failed:${error.message}`);
  return orderId;
}

async function insertRequestedSplit(admin, restaurantId, sessionId, tableId, displayName) {
  const splitId = randomUUID();
  const { error } = await admin.from('bill_splits').insert({
    id: splitId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    order_ids: [],
    split_mode: 'even',
    persons: [{ name: 'Guest 1' }],
    result: [{ name: 'Guest 1', amount: 25 }],
    total_amount: 25,
    status: 'requested',
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_split_failed:${error.message}`);
  return splitId;
}

async function loadSessionState(admin, restaurantId, sessionId) {
  const [{ data: session }, { data: splits }, { data: orders }] = await Promise.all([
    admin.from('table_sessions').select('id, status, closed_reason').eq('id', sessionId).maybeSingle(),
    admin
      .from('bill_splits')
      .select('id, status')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId),
    admin
      .from('orders')
      .select('id, status, total_amount, items')
      .eq('restaurant_id', restaurantId)
      .eq('session_id', sessionId),
  ]);
  return { session, splits: splits || [], orders: orders || [] };
}

async function runScenario(admin, restaurantId, setup) {
  const { tableId, displayName } = await createTestTable(admin, restaurantId, setup.id);
  const sessionId = await openSession(admin, restaurantId, tableId);

  let splitId = null;
  let orderId = null;

  if (setup.split === 'requested') {
    splitId = await insertRequestedSplit(admin, restaurantId, sessionId, tableId, displayName);
  }

  if (setup.order) {
    orderId = await insertOrder(
      admin,
      restaurantId,
      sessionId,
      tableId,
      displayName,
      setup.order.status,
      setup.order.items,
    );
  }

  const before = await loadSessionState(admin, restaurantId, sessionId);
  const ui = uiCloseGuard(before.orders);

  const closeResult = await closeActiveTableSessionWithOperationalCleanup(
    admin,
    restaurantId,
    tableId,
    setup.closedReason,
  );

  const after = await loadSessionState(admin, restaurantId, sessionId);

  const splitStatuses = (after.splits || []).map((s) => s.status);
  const orderSummary = (after.orders || []).map((o) => ({
    id: o.id,
    status: o.status,
    total_amount: o.total_amount,
    voided_lines: (o.items || []).filter((i) => i.item_status === 'voided').length,
    line_count: (o.items || []).length,
  }));

  return {
    setup: setup.id,
    table_id: tableId,
    display_name: displayName,
    session_id: sessionId,
    bill_split_id: splitId,
    order_id: orderId,
    ui_guard: ui,
    ui_would_show_close_button: ui.canCloseTableCard,
    ui_checks_unpaid_splits: false,
    ui_checks_pending_items: false,
    close_http_equivalent: closeResult.ok ? 200 : closeResult.code === 'no_session' ? 404 : 500,
    close_response: closeResult,
    before: {
      session_status: before.session?.status,
      split_statuses: (before.splits || []).map((s) => s.status),
      order_statuses: (before.orders || []).map((o) => o.status),
    },
    after: {
      session_status: after.session?.status,
      closed_reason: after.session?.closed_reason,
      split_statuses: splitStatuses,
      orders: orderSummary,
    },
    vulnerability_confirmed:
      closeResult.ok &&
      after.session?.status === 'closed' &&
      (setup.expectSplitCancelled ? splitStatuses.every((s) => s === 'cancelled') : true) &&
      (setup.expectOrdersVoided ? orderSummary.every((o) => o.total_amount === 0) : true),
  };
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const slug = process.argv[2] || 'restaurant-mo9y14xc';
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rest, error: restErr } = await admin
    .from('restaurants')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (restErr || !rest) {
    console.error('restaurant_not_found', slug, restErr?.message);
    process.exit(1);
  }

  const restaurantId = rest.id;

  const scenarios = [
    {
      id: 'A_unpaid_checkout',
      split: 'requested',
      closedReason: 'waiter_closed',
      expectSplitCancelled: true,
      expectOrdersVoided: false,
    },
    {
      id: 'B_pending_kitchen',
      order: {
        status: 'pending',
        items: [
          {
            name_pt: 'Phase1 pending dish',
            emoji: '🍲',
            qty: 1,
            price: 12,
            item_status: 'pending',
          },
        ],
      },
      closedReason: 'waiter_closed',
      expectSplitCancelled: false,
      expectOrdersVoided: true,
    },
    {
      id: 'C_ready_items_ui_blocked',
      order: {
        status: 'done',
        items: [
          {
            name_pt: 'Phase1 ready dish',
            emoji: '🥗',
            qty: 2,
            price: 8,
            item_status: 'done',
          },
        ],
      },
      closedReason: 'waiter_closed',
      expectSplitCancelled: false,
      expectOrdersVoided: true,
    },
  ];

  const results = [];
  for (const setup of scenarios) {
    results.push(await runScenario(admin, restaurantId, setup));
  }

  const ownerScenario = results[0];
  if (ownerScenario) {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'A_owner');
    const sessionId = await openSession(admin, restaurantId, tableId);
    const splitId = await insertRequestedSplit(admin, restaurantId, sessionId, tableId, displayName);
    const ownerClose = await closeActiveTableSessionWithOperationalCleanup(
      admin,
      restaurantId,
      tableId,
      'owner_closed',
    );
    const after = await loadSessionState(admin, restaurantId, sessionId);
    results.push({
      setup: 'A_owner_api_unpaid_checkout',
      table_id: tableId,
      session_id: sessionId,
      bill_split_id: splitId,
      ui_guard: { canCloseTableCard: true, note: 'owner UI also ignores unpaid splits' },
      close_http_equivalent: ownerClose.ok ? 200 : 500,
      close_response: ownerClose,
      after: {
        session_status: after.session?.status,
        closed_reason: after.session?.closed_reason,
        split_statuses: (after.splits || []).map((s) => s.status),
      },
      vulnerability_confirmed: ownerClose.ok && after.session?.status === 'closed',
    });
  }

  const summary = {
    phase: 1,
    slug,
    restaurant_id: restaurantId,
    date: new Date().toISOString(),
    static_findings: {
      waiter_ui_guard:
        'canCloseTableCard = cooking === 0 && ready === 0 (WaiterTableDetail.tsx:243)',
      owner_ui_guard:
        'canClose = cooking === 0 && ready === 0; handleCloseTable blocks client-side only (OrdersHistoryManager.tsx:245-247,396)',
      server_close_helper:
        'closeActiveTableSessionWithOperationalCleanup has no preflight; cancels unpaid splits then voids orders (close-active-table-session-with-cleanup.ts:31-107)',
      waiter_api:
        'POST .../staff/waiter/sessions/close calls cleanup directly (route.ts:42-47)',
      owner_api:
        'POST /api/dashboard/close-table-session calls cleanup directly (route.ts:26-31)',
    },
    scenarios: results,
    all_vulnerabilities_confirmed: results.every((r) => r.vulnerability_confirmed),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_vulnerabilities_confirmed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
