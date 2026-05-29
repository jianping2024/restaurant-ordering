/**
 * Phase 0: reproduce confirm-payment lost-update (read-only on repo logic; mutates test bill_split).
 * Usage: node scripts/phase0-checkout-confirm-race.mjs [slug]
 */
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
    /* .env.local optional if env already set */
  }
}

function normalizeSplitRows(split) {
  const rows = Array.isArray(split.result) ? split.result : [];
  if (rows.length > 0) return rows;
  if (Number(split.total_amount) > 0) {
    return [{ name: 'Total', amount: Number(split.total_amount) }];
  }
  return [];
}

function applyDiscountToRows(rows, discountRate) {
  const rate = Math.min(100, Math.max(0, discountRate));
  const factor = 1 - rate / 100;
  return rows.map((row) => ({
    ...row,
    amount: Number(row.amount) * factor,
  }));
}

/** Mirrors confirmBillSplitPayment DB path (checkout-confirm-payment.ts L52-92). */
async function confirmOne(admin, restaurantId, billSplitId, personIndex) {
  const { data: split, error: loadErr } = await admin
    .from('bill_splits')
    .select('*')
    .eq('id', billSplitId)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();

  if (loadErr || !split) {
    return { ok: false, code: 'bill_split_not_found', message: loadErr?.message };
  }

  const baseRows = normalizeSplitRows(split);
  if (baseRows.length === 0) {
    return { ok: false, code: 'empty_split' };
  }
  if (personIndex < 0 || personIndex >= baseRows.length) {
    return { ok: false, code: 'invalid_person_index' };
  }

  const discountedRows = applyDiscountToRows(baseRows, 0);
  const row = discountedRows[personIndex];
  if (row.paid) {
    return { ok: false, code: 'already_paid' };
  }

  const nextResult = discountedRows.map((item, idx) =>
    idx === personIndex ? { ...item, paid: true } : item,
  );
  const allPaid = nextResult.every((item) => !!item.paid);
  const finalAmount = nextResult.reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const { error: billErr } = await admin
    .from('bill_splits')
    .update({
      status: allPaid ? 'paid' : 'requested',
      total_amount: allPaid ? finalAmount : split.total_amount,
      result: nextResult,
    })
    .eq('id', billSplitId);

  if (billErr) {
    return { ok: false, code: 'bill_update_failed', message: billErr.message };
  }

  return {
    ok: true,
    personIndex,
    all_paid: allPaid,
    result: nextResult,
    final_amount: finalAmount,
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
    .select('id, slug, print_locale')
    .eq('slug', slug)
    .maybeSingle();

  if (restErr || !rest) {
    console.error('restaurant_not_found', slug, restErr?.message);
    process.exit(1);
  }

  const restaurantId = rest.id;

  const { data: candidates, error: candErr } = await admin
    .from('bill_splits')
    .select('id, result, status, session_id, table_id, display_name')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (candErr) {
    console.error('load_splits_failed', candErr.message);
    process.exit(1);
  }

  let billSplitId = process.env.PHASE0_BILL_SPLIT_ID || null;
  let seedFromRow = null;
  for (const row of candidates || []) {
    const rows = normalizeSplitRows(row);
    if (rows.length >= 2) {
      if (!billSplitId && rows.every((r) => !r.paid)) {
        billSplitId = row.id;
        break;
      }
      if (!seedFromRow) seedFromRow = row;
    }
  }

  if (!billSplitId && seedFromRow) {
    billSplitId = seedFromRow.id;
    console.log(
      JSON.stringify({
        action: 'reuse_split_reset_unpaid',
        bill_split_id: billSplitId,
        prior_status: seedFromRow.status,
      }),
    );
  }

  if (!billSplitId) {
    const { data: session } = await admin
      .from('table_sessions')
      .select('id, table_id, display_name')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'billing')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      console.error('no_billing_session: create a 2-person split in UI first');
      process.exit(1);
    }

    const seedResult = [
      { name: 'Person A', amount: 50, paid: false },
      { name: 'Person B', amount: 50, paid: false },
    ];
    const { data: inserted, error: insErr } = await admin
      .from('bill_splits')
      .insert({
        restaurant_id: restaurantId,
        session_id: session.id,
        table_id: session.table_id,
        display_name: session.display_name,
        split_mode: 'even',
        persons: [],
        result: seedResult,
        total_amount: 100,
        status: 'requested',
        order_ids: [],
      })
      .select('id')
      .single();

    if (insErr || !inserted) {
      console.error('seed_split_failed', insErr?.message);
      process.exit(1);
    }
    billSplitId = inserted.id;
    console.log(JSON.stringify({ action: 'seeded_test_split', bill_split_id: billSplitId }));
  }

  const { data: targetSplit } = await admin
    .from('bill_splits')
    .select('result')
    .eq('id', billSplitId)
    .single();

  const baseForReset = normalizeSplitRows(targetSplit || { result: [] });
  const resetResult =
    baseForReset.length >= 2
      ? baseForReset.map((r) => ({
          ...r,
          paid: false,
          amount: Number(r.amount) || 0,
        }))
      : [
          { name: 'Person A', amount: 50, paid: false },
          { name: 'Person B', amount: 50, paid: false },
        ];
  const resetTotal = resetResult.reduce((s, r) => s + Number(r.amount || 0), 0);

  await admin
    .from('bill_splits')
    .update({
      result: resetResult,
      total_amount: resetTotal,
      status: 'requested',
    })
    .eq('id', billSplitId)
    .eq('restaurant_id', restaurantId);

  const before = await admin
    .from('bill_splits')
    .select('result, status')
    .eq('id', billSplitId)
    .single();

  const useRpc = process.argv.includes('--rpc');

  const t0 = Date.now();
  const [r0, r1] = await Promise.all([
    useRpc
      ? admin.rpc('confirm_bill_split_payment', {
          p_restaurant_id: restaurantId,
          p_bill_split_id: billSplitId,
          p_person_index: 0,
          p_discount_rate: 0,
        }).then(({ data, error }) =>
          error
            ? { ok: false, code: 'rpc_error', message: error.message }
            : data,
        )
      : confirmOne(admin, restaurantId, billSplitId, 0),
    useRpc
      ? admin.rpc('confirm_bill_split_payment', {
          p_restaurant_id: restaurantId,
          p_bill_split_id: billSplitId,
          p_person_index: 1,
          p_discount_rate: 0,
        }).then(({ data, error }) =>
          error
            ? { ok: false, code: 'rpc_error', message: error.message }
            : data,
        )
      : confirmOne(admin, restaurantId, billSplitId, 1),
  ]);
  const elapsedMs = Date.now() - t0;

  const after = await admin
    .from('bill_splits')
    .select('result, status, total_amount')
    .eq('id', billSplitId)
    .single();

  const paidCount = (after.data?.result || []).filter((r) => r.paid).length;

  console.log(
    JSON.stringify(
      {
        phase: useRpc ? '2-rpc-verify' : 0,
        mode: useRpc ? 'rpc' : 'legacy_ts_path',
        slug,
        restaurant_id: restaurantId,
        bill_split_id: billSplitId,
        before: before.data,
        concurrent: { person_0: r0, person_1: r1, elapsed_ms: elapsedMs },
        after: after.data,
        paid_rows_in_db: paidCount,
        lost_update_detected: paidCount < 2 && r0.ok && r1.ok,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
