/**
 * Phase 3: verify checkout guard on waiter/owner close path; auto-close bypass.
 * Mirrors closeTableSessionWithCheckoutGuard + closeActiveTableSessionWithOperationalCleanup.
 *
 * Usage: node scripts/phase3-table-session-close-guards.mjs [slug]
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

const FAKE_CLOSER_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function voidAllLineItemsForForcedClose(items) {
  const now = new Date().toISOString();
  return (items || []).map((item) => {
    if (item.kind === 'buffet_base') return item;
    if (item.item_status === 'voided') return item;
    return { ...item, item_status: 'voided', voided_at: now };
  });
}

async function evaluateTableSessionCloseGuards(admin, restaurantId, tableId, options = {}) {
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
  const { count, error: splitErr } = await admin
    .from('bill_splits')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .eq('status', 'requested');

  if (splitErr) {
    return { ok: false, code: 'no_session', message: splitErr.message };
  }

  const checkout_requested = count ?? 0;
  if (!options.confirm_close && !options.confirm_checkout_close) {
    return {
      ok: false,
      code: 'close_confirm_required',
      session_id: sessionId,
      reasons: { checkout_requested: checkout_requested },
      http_status: 409,
    };
  }

  return { ok: true, session_id: sessionId };
}

async function probeClosedByUserColumn(admin) {
  const { error } = await admin.from('table_sessions').select('closed_by_user_id').limit(1);
  if (error?.message?.includes('closed_by_user_id')) return false;
  return !error;
}

async function closeActiveTableSessionWithOperationalCleanup(
  admin,
  restaurantId,
  tableId,
  closedReason,
  audit = {},
  includeAuditColumn = true,
) {
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

  await admin
    .from('bill_splits')
    .update({ status: 'cancelled' })
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'confirmed', 'requested']);

  const { data: orderRows } = await admin
    .from('orders')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('session_id', sessionId)
    .in('status', ['pending', 'cooking', 'done']);

  const nowIso = new Date().toISOString();
  for (const row of orderRows || []) {
    const nextItems = voidAllLineItemsForForcedClose(row.items || []);
    await admin
      .from('orders')
      .update({
        items: nextItems,
        status: 'done',
        total_amount: 0,
        updated_at: nowIso,
      })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId);
  }

  const sessionUpdate = {
    status: 'closed',
    closed_at: nowIso,
    closed_reason: closedReason,
  };
  if (includeAuditColumn) {
    sessionUpdate.closed_by_user_id = audit.closed_by_user_id ?? null;
  }

  const { error: sessionErr } = await admin
    .from('table_sessions')
    .update(sessionUpdate)
    .eq('id', sessionId);

  if (sessionErr) {
    return { ok: false, code: 'update_failed', message: sessionErr.message };
  }

  return { ok: true, session_id: sessionId, http_status: 200 };
}

async function closeTableSessionWithCheckoutGuard(
  admin,
  restaurantId,
  tableId,
  closedReason,
  options = {},
  includeAuditColumn = true,
) {
  const guard = await evaluateTableSessionCloseGuards(admin, restaurantId, tableId, options);
  if (!guard.ok) {
    return { ok: false, ...guard };
  }
  return closeActiveTableSessionWithOperationalCleanup(
    admin,
    restaurantId,
    tableId,
    closedReason,
    { closed_by_user_id: options.closed_by_user_id ?? null },
    includeAuditColumn,
  );
}

async function createTestTable(admin, restaurantId, label) {
  const suffix = Date.now().toString(36).slice(-3);
  const displayName = `P3${String(label).slice(0, 2)}${suffix}`.slice(0, 16);
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

async function insertSplit(admin, restaurantId, sessionId, tableId, displayName, status) {
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
    status,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_split_failed:${error.message}`);
  return splitId;
}

async function insertOrder(admin, restaurantId, sessionId, tableId, displayName, status) {
  const orderId = randomUUID();
  const { error } = await admin.from('orders').insert({
    id: orderId,
    restaurant_id: restaurantId,
    session_id: sessionId,
    table_id: tableId,
    display_name: displayName,
    status,
    items: [
      {
        name_pt: 'Phase3 dish',
        emoji: '🍲',
        qty: 1,
        price: 12,
        item_status: status === 'done' ? 'done' : status,
      },
    ],
    total_amount: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`create_order_failed:${error.message}`);
  return orderId;
}

async function loadSession(admin, sessionId, includeAuditColumn) {
  const selectCols = includeAuditColumn
    ? 'id, status, closed_reason, closed_by_user_id'
    : 'id, status, closed_reason';
  const { data: session } = await admin
    .from('table_sessions')
    .select(selectCols)
    .eq('id', sessionId)
    .maybeSingle();
  const { data: splits } = await admin
    .from('bill_splits')
    .select('status')
    .eq('session_id', sessionId);
  return { session, splits: splits || [] };
}

async function runGuardedClose(admin, restaurantId, tableId, opts, includeAuditColumn) {
  return closeTableSessionWithCheckoutGuard(
    admin,
    restaurantId,
    tableId,
    opts.closedReason || 'waiter_closed',
    {
      confirm_close: opts.confirm_close === true || opts.confirm_checkout_close === true,
      closed_by_user_id: opts.closed_by_user_id ?? null,
    },
    includeAuditColumn,
  );
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing env');
    process.exit(1);
  }

  const slug = process.argv[2] || 'restaurant-mo9y14xc';
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rest } = await admin.from('restaurants').select('id, slug').eq('slug', slug).maybeSingle();
  if (!rest?.id) {
    console.error('restaurant_not_found', slug);
    process.exit(1);
  }
  const restaurantId = rest.id;
  const includeAuditColumn = await probeClosedByUserColumn(admin);

  const results = [];

  // 1) any session, no confirm → 409
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'req');
    const sessionId = await openSession(admin, restaurantId, tableId);
    await insertSplit(admin, restaurantId, sessionId, tableId, displayName, 'requested');
    const close = await runGuardedClose(admin, restaurantId, tableId, {}, includeAuditColumn);
    const after = await loadSession(admin, sessionId, includeAuditColumn);
    results.push({
      id: '1_no_confirm',
      expect: '409 close_confirm_required, session open',
      pass:
        !close.ok &&
        close.code === 'close_confirm_required' &&
        close.http_status === 409 &&
        after.session?.status === 'billing',
      actual: { close, session_status: after.session?.status },
    });
  }

  // 2) confirm_close → 200
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'cfm');
    const sessionId = await openSession(admin, restaurantId, tableId);
    await insertSplit(admin, restaurantId, sessionId, tableId, displayName, 'requested');
    const close = await runGuardedClose(admin, restaurantId, tableId, {
      confirm_close: true,
      closed_by_user_id: FAKE_CLOSER_USER_ID,
      closedReason: 'owner_closed',
    }, includeAuditColumn);
    const after = await loadSession(admin, sessionId, includeAuditColumn);
    const auditOk = includeAuditColumn
      ? after.session?.closed_by_user_id === FAKE_CLOSER_USER_ID
      : true;
    results.push({
      id: '2_with_confirm',
      expect: '200 closed after confirm_close',
      pass:
        close.ok &&
        after.session?.status === 'closed' &&
        after.session?.closed_reason === 'owner_closed' &&
        auditOk &&
        after.splits.every((s) => s.status === 'cancelled'),
      actual: { close, session: after.session, audit_column: includeAuditColumn },
    });
  }

  // 3) kitchen only, no confirm → 409
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'kit');
    const sessionId = await openSession(admin, restaurantId, tableId);
    await insertOrder(admin, restaurantId, sessionId, tableId, displayName, 'cooking');
    const close = await runGuardedClose(admin, restaurantId, tableId, {}, includeAuditColumn);
    const after = await loadSession(admin, sessionId, includeAuditColumn);
    results.push({
      id: '3_kitchen_no_confirm',
      expect: '409 close_confirm_required',
      pass: !close.ok && close.code === 'close_confirm_required' && after.session?.status === 'billing',
      actual: close,
    });
  }

  // 4) kitchen + confirm → 200
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'kit2');
    const sessionId = await openSession(admin, restaurantId, tableId);
    await insertOrder(admin, restaurantId, sessionId, tableId, displayName, 'cooking');
    const close = await runGuardedClose(admin, restaurantId, tableId, { confirm_close: true }, includeAuditColumn);
    const after = await loadSession(admin, sessionId, includeAuditColumn);
    results.push({
      id: '4_kitchen_with_confirm',
      expect: '200 closed after confirm',
      pass: close.ok && after.session?.status === 'closed',
      actual: close,
    });
  }

  // 5) auto_nightly bypass
  {
    const { tableId, displayName } = await createTestTable(admin, restaurantId, 'aut');
    const sessionId = await openSession(admin, restaurantId, tableId);
    await insertSplit(admin, restaurantId, sessionId, tableId, displayName, 'requested');
    const close = await closeActiveTableSessionWithOperationalCleanup(
      admin,
      restaurantId,
      tableId,
      'auto_nightly',
      {},
      includeAuditColumn,
    );
    const after = await loadSession(admin, sessionId, includeAuditColumn);
    results.push({
      id: '5_auto_nightly_bypass',
      expect: '200 closed without guard, closed_by_user_id null',
      pass:
        close.ok &&
        after.session?.status === 'closed' &&
        after.session?.closed_reason === 'auto_nightly' &&
        (includeAuditColumn ? after.session?.closed_by_user_id == null : true),
      actual: close,
    });
  }

  const summary = {
    phase: 3,
    slug,
    restaurant_id: restaurantId,
    closed_by_user_id_column: includeAuditColumn,
    date: new Date().toISOString(),
    phase3_scope: {
      changes: [
        'Manual close always requires confirm_close on API',
        '409 close_confirm_required without confirm',
        'auto-close uses cleanup directly (no guard)',
      ],
      unchanged: [
        'closeActiveTableSessionWithOperationalCleanup order (splits → orders → session)',
        'auto-close uses cleanup directly (no guard)',
        'confirm_bill_split_payment paid close path',
        'merge closed_reason=merged',
      ],
    },
    results,
    all_pass: results.every((r) => r.pass),
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(summary.all_pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
