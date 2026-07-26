import { createClient } from '@supabase/supabase-js';
import { getValueOverview } from '@/lib/analytics/analytics.service';
import {
  ANALYTICS_RANGES,
  PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID,
  type AnalyticsRange,
} from '@/lib/analytics/analytics.types';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing env');

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const summary: Record<string, unknown> = {};

  for (const range of ANALYTICS_RANGES) {
    const result = await getValueOverview(admin, PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID, range);
    if (!result.ok) {
      console.error(range, result);
      process.exit(1);
    }

    const total = result.data.revenueTrend.reduce((s, p) => s + p.revenue, 0);
    const guests = result.data.customerTrend.reduce((s, p) => s + p.customerCount, 0);
    summary[range] = {
      schemaVersion: result.data.schemaVersion,
      points: result.data.revenueTrend.length,
      totalRevenue: Math.round(total * 100) / 100,
      totalGuests: guests,
      first: result.data.revenueTrend[0]?.date ?? null,
      last: result.data.revenueTrend[result.data.revenueTrend.length - 1]?.date ?? null,
      hasTop: 'topConsumedItems' in result.data,
    };
  }

  console.log(JSON.stringify({ ok: true, summary }, null, 2));

  const day = summary.day as { totalRevenue: number; points: number; hasTop: boolean };
  if (day.points !== 30) {
    console.error('FAIL: day grain should return 30 points');
    process.exit(1);
  }
  if (day.totalRevenue < 40000) {
    console.error('FAIL: expected day-window revenue well above truncated ~18k');
    process.exit(1);
  }
  if (day.hasTop) {
    console.error('FAIL: topConsumedItems should be cut from overview');
    process.exit(1);
  }

  for (const range of ['week', 'month', 'quarter'] as AnalyticsRange[]) {
    const row = summary[range] as { totalRevenue: number; points: number };
    if (row.points < 1) {
      console.error(`FAIL: ${range} should have at least one period with activity`);
      process.exit(1);
    }
    if (row.totalRevenue < 40000) {
      console.error(`FAIL: ${range} YTD revenue unexpectedly low`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
