/**
 * Phase 4: print dedup + flags after confirmBillSplitPayment.
 * Usage: npx tsx scripts/phase4-verify-checkout-print.mts [slug]
 */
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import { confirmBillSplitPayment } from '../src/lib/checkout-confirm-payment.ts';
import { checkoutReceiptIdempotencyKey } from '../src/lib/order-receipt-enqueue.ts';

function loadEnvLocal() {
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
}

async function countCheckoutPrintJobs(
  admin: ReturnType<typeof createClient>,
  restaurantId: string,
  billSplitId: string,
) {
  const prefix = `checkout:${billSplitId}:`;
  const { data } = await admin
    .from('print_jobs')
    .select('id, payload, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('type', 'order_receipt')
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (data || []).filter((j) => {
    const key = (j.payload as { idempotency_key?: string })?.idempotency_key;
    return typeof key === 'string' && key.startsWith(prefix);
  });
  return rows;
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const slug = process.argv[2] || 'restaurant-mo9y14xc';
  const { data: rest } = await admin.from('restaurants').select('id').eq('slug', slug).single();
  const restaurantId = rest!.id as string;

  const { data: split } = await admin
    .from('bill_splits')
    .select('id, result, session_id')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const billSplitId = split!.id as string;
  const sessionId = split!.session_id as string;
  const base = Array.isArray(split!.result) ? split!.result : [];
  const resetResult =
    base.length >= 2
      ? base.map((r: { name?: string; amount?: number }) => ({
          ...r,
          paid: false,
          amount: Number(r.amount) || 0,
        }))
      : [
          { name: 'A', amount: 50, paid: false },
          { name: 'B', amount: 50, paid: false },
        ];

  await admin
    .from('bill_splits')
    .update({ result: resetResult, status: 'requested', total_amount: 100 })
    .eq('id', billSplitId);
  await admin
    .from('table_sessions')
    .update({ status: 'billing', closed_at: null })
    .eq('id', sessionId);

  const cases: Array<{ name: string; expected: string; actual: string; pass: boolean }> = [];

  // 1) concurrent two payers → 2 split keys + 1 final
  await admin
    .from('print_jobs')
    .delete()
    .eq('restaurant_id', restaurantId)
    .filter('payload->>idempotency_key', 'like', `checkout:${billSplitId}:%`);

  await Promise.all([
    confirmBillSplitPayment({
      admin,
      restaurantId,
      printLocale: 'pt',
      billSplitId,
      personIndex: 0,
    }),
    confirmBillSplitPayment({
      admin,
      restaurantId,
      printLocale: 'pt',
      billSplitId,
      personIndex: 1,
    }),
  ]);

  const afterConcurrent = await countCheckoutPrintJobs(admin, restaurantId, billSplitId);
  const keys = afterConcurrent.map(
    (j) => (j.payload as { idempotency_key?: string }).idempotency_key,
  );
  const splitKeys = keys.filter((k) => k?.includes(':split:'));
  const finalKeys = keys.filter((k) => k?.endsWith(':final'));
  cases.push({
    name: 'concurrent_two_split_plus_one_final',
    expected: '2 split idempotency keys, 1 final',
    actual: `split=${splitKeys.length} final=${finalKeys.length} keys=${keys.join(',')}`,
    pass: splitKeys.length === 2 && finalKeys.length === 1,
  });

  // 2) retry same index → no new jobs
  const beforeRetry = afterConcurrent.length;
  const retry = await confirmBillSplitPayment({
    admin,
    restaurantId,
    printLocale: 'pt',
    billSplitId,
    personIndex: 0,
  });
  const afterRetry = await countCheckoutPrintJobs(admin, restaurantId, billSplitId);
  cases.push({
    name: 'retry_already_paid_no_new_print',
    expected: '409 already_paid; print job count unchanged',
    actual: `${retry.ok ? 'ok' : retry.code}; jobs ${beforeRetry} -> ${afterRetry.length}`,
    pass: !retry.ok && retry.code === 'already_paid' && afterRetry.length === beforeRetry,
  });

  // 3) manual dedup: enqueue same key twice via direct insert path — call confirm again on fresh reset person 0 only
  await admin
    .from('bill_splits')
    .update({
      result: [
        { name: 'A', amount: 50, paid: true },
        { name: 'B', amount: 50, paid: false },
      ],
      status: 'requested',
    })
    .eq('id', billSplitId);
  await admin
    .from('table_sessions')
    .update({ status: 'billing', closed_at: null })
    .eq('id', sessionId);

  const key0 = checkoutReceiptIdempotencyKey('split_payment', billSplitId, 0)!;
  const jobsBefore = await countCheckoutPrintJobs(admin, restaurantId, billSplitId);

  await confirmBillSplitPayment({
    admin,
    restaurantId,
    printLocale: 'pt',
    billSplitId,
    personIndex: 1,
  });
  const dup = await confirmBillSplitPayment({
    admin,
    restaurantId,
    printLocale: 'pt',
    billSplitId,
    personIndex: 1,
  });
  const jobsAfter = await countCheckoutPrintJobs(admin, restaurantId, billSplitId);
  const key1 = checkoutReceiptIdempotencyKey('split_payment', billSplitId, 1)!;
  const countKey1 = jobsAfter.filter(
    (j) => (j.payload as { idempotency_key?: string }).idempotency_key === key1,
  ).length;

  cases.push({
    name: 'duplicate_confirm_person_1',
    expected: 'second call 409; at most 1 job for split:1 key',
    actual: `${dup.ok ? 'ok' : dup.code}; key1_jobs=${countKey1}`,
    pass: !dup.ok && dup.code === 'already_paid' && countKey1 <= 1,
  });

  void key0;
  void jobsBefore;

  const allPass = cases.every((c) => c.pass);
  console.log(JSON.stringify({ phase: 4, bill_split_id: billSplitId, cases, all_pass: allPass }, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
