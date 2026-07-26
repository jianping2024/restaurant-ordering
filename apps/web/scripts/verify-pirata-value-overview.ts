import { createClient } from '@supabase/supabase-js';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import { PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID } from '@/lib/analytics/analytics.types';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing env');

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await getValueOverview(admin, PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID, '30d');
  if (!result.ok) {
    console.error(result);
    process.exit(1);
  }

  const total = result.data.revenueTrend.reduce((s, p) => s + p.revenue, 0);
  const guests = result.data.customerTrend.reduce((s, p) => s + p.customerCount, 0);
  const last = result.data.revenueTrend[result.data.revenueTrend.length - 1];
  const peak = [...result.data.revenueTrend].sort((a, b) => b.revenue - a.revenue)[0];

  console.log(
    JSON.stringify(
      {
        ok: true,
        schemaVersion: result.data.schemaVersion,
        points: result.data.revenueTrend.length,
        totalRevenue: Math.round(total * 100) / 100,
        totalGuests: guests,
        lastDay: last,
        peakDay: peak,
        hasTop: 'topConsumedItems' in result.data,
      },
      null,
      2,
    ),
  );

  if (total < 40000) {
    console.error('FAIL: expected period revenue well above truncated ~18k');
    process.exit(1);
  }
  if (peak && peak.revenue < 9000) {
    console.error('FAIL: expected late-July peak near 10k+');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
