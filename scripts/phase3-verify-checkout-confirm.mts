/**
 * Phase 3 verification: concurrent confirmBillSplitPayment (TS → RPC).
 * Usage: npx --yes tsx scripts/phase3-verify-checkout-confirm.mts [slug]
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { confirmBillSplitPayment } from '../src/lib/checkout-confirm-payment.ts';

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
    /* env may already be set */
  }
}

function normalizeSplitRows(split: { result?: unknown; total_amount?: number }) {
  const rows = Array.isArray(split.result) ? split.result : [];
  if (rows.length > 0) return rows;
  if (Number(split.total_amount) > 0) {
    return [{ name: 'Total', amount: Number(split.total_amount) }];
  }
  return [];
}

async function resetSplit(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  billSplitId: string,
) {
  const { data: split } = await admin
    .from('bill_splits')
    .select('result')
    .eq('id', billSplitId)
    .single();

  const base = normalizeSplitRows(split || {});
  const resetResult =
    base.length >= 2
      ? base.map((r: { name?: string; amount?: number }) => ({
          ...r,
          paid: false,
          amount: Number(r.amount) || 0,
        }))
      : [
          { name: 'Person A', amount: 50, paid: false },
          { name: 'Person B', amount: 50, paid: false },
        ];
  const total = resetResult.reduce((s, r) => s + Number(r.amount || 0), 0);

  await admin
    .from('bill_splits')
    .update({ result: resetResult, total_amount: total, status: 'requested' })
    .eq('id', billSplitId)
    .eq('restaurant_id', restaurantId);

  await admin
    .from('table_sessions')
    .update({ status: 'billing', closed_at: null })
    .eq('id', (await admin.from('bill_splits').select('session_id').eq('id', billSplitId).single())
      .data?.session_id);

  return resetResult;
}

async function loadDbState(admin: ReturnType<typeof createClient>, billSplitId: string) {
  const { data } = await admin
    .from('bill_splits')
    .select('result, status, total_amount')
    .eq('id', billSplitId)
    .single();
  const paidCount = (data?.result || []).filter(
    (r: { paid?: boolean }) => !!r.paid,
  ).length;
  return { row: data, paidCount };
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('missing supabase env');
    process.exit(1);
  }

  const slug = process.argv[2] || 'restaurant-mo9y14xc';
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: rest } = await admin.from('restaurants').select('id').eq('slug', slug).single();
  if (!rest) {
    console.error('restaurant_not_found');
    process.exit(1);
  }
  const restaurantId = rest.id as string;

  const { data: splits } = await admin
    .from('bill_splits')
    .select('id, result')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(5);

  const billSplitId =
    splits?.find((s) => normalizeSplitRows(s).length >= 2)?.id ?? splits?.[0]?.id;
  if (!billSplitId) {
    console.error('no_bill_split');
    process.exit(1);
  }

  const cases: Array<{
    name: string;
    expected: string;
    actual: string;
    pass: boolean;
  }> = [];

  // Case 1: concurrent different person_index
  await resetSplit(admin, restaurantId, billSplitId);
  const [c0, c1] = await Promise.all([
    confirmBillSplitPayment({
      admin,
      restaurantId,
      printLocale: null,
      billSplitId,
      personIndex: 0,
    }),
    confirmBillSplitPayment({
      admin,
      restaurantId,
      printLocale: null,
      billSplitId,
      personIndex: 1,
    }),
  ]);
  const afterConcurrent = await loadDbState(admin, billSplitId);
  const concurrentPass =
    c0.ok &&
    c1.ok &&
    afterConcurrent.paidCount === 2 &&
    afterConcurrent.row?.status === 'paid';
  cases.push({
    name: 'concurrent_person_0_and_1',
    expected: 'both ok; DB 2 paid rows; status paid',
    actual: `r0=${c0.ok ? 'ok' : c0.code}; r1=${c1.ok ? 'ok' : c1.code}; paid=${afterConcurrent.paidCount}; status=${afterConcurrent.row?.status}`,
    pass: concurrentPass,
  });

  // Case 2: already_paid
  const dup = await confirmBillSplitPayment({
    admin,
    restaurantId,
    printLocale: null,
    billSplitId,
    personIndex: 0,
  });
  cases.push({
    name: 'already_paid_same_index',
    expected: '409 already_paid',
    actual: dup.ok ? 'unexpected ok' : `${dup.status} ${dup.code}`,
    pass: !dup.ok && dup.code === 'already_paid' && dup.status === 409,
  });

  // Case 3: wrong restaurant
  const wrongRest = await confirmBillSplitPayment({
    admin,
    restaurantId: '00000000-0000-0000-0000-000000000001',
    printLocale: null,
    billSplitId,
    personIndex: 0,
  });
  cases.push({
    name: 'wrong_restaurant_id',
    expected: '404 bill_split_not_found',
    actual: wrongRest.ok ? 'unexpected ok' : `${wrongRest.status} ${wrongRest.code}`,
    pass: !wrongRest.ok && wrongRest.code === 'bill_split_not_found' && wrongRest.status === 404,
  });

  // Case 4: invalid person_index
  await resetSplit(admin, restaurantId, billSplitId);
  const badIdx = await confirmBillSplitPayment({
    admin,
    restaurantId,
    printLocale: null,
    billSplitId,
    personIndex: 99,
  });
  cases.push({
    name: 'invalid_person_index',
    expected: '400 invalid_person_index',
    actual: badIdx.ok ? 'unexpected ok' : `${badIdx.status} ${badIdx.code}`,
    pass: !badIdx.ok && badIdx.code === 'invalid_person_index' && badIdx.status === 400,
  });

  const allPass = cases.every((c) => c.pass);

  console.log(
    JSON.stringify(
      {
        phase: 3,
        slug,
        bill_split_id: billSplitId,
        cases,
        all_pass: allPass,
        concurrent_detail: {
          response_0: c0,
          response_1: c1,
          db_after: afterConcurrent.row,
        },
      },
      null,
      2,
    ),
  );

  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
