import { createClient } from '@supabase/supabase-js';
import { fetchDistinctClosedBusinessDates } from '@/lib/analytics/analytics.repository';
import { sealRestaurantBusinessDay } from '@/lib/analytics/daily-stats';
import { PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID } from '@/lib/analytics/analytics.types';
import {
  addCalendarDays,
  calendarDateInTimezone,
  lisbonDayStartUtcIso,
} from '@/lib/lisbon-calendar';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const today = calendarDateInTimezone(new Date());
  const startDate = addCalendarDays(today, -30);
  const endDate = addCalendarDays(today, -1);
  const startUtc = lisbonDayStartUtcIso(startDate);
  const endExclusiveUtc = lisbonDayStartUtcIso(today);

  const closed = await fetchDistinctClosedBusinessDates(
    admin,
    PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID,
    startUtc,
    endExclusiveUtc,
  );
  if (!closed.ok) {
    throw new Error(`${closed.code} ${closed.message || ''}`);
  }

  console.log(
    `Sealing ${closed.dates.length} closed-session days for Pirata (window ${startDate}..${endDate}, today=${today})`,
  );

  let fail = 0;
  for (const day of closed.dates) {
    const result = await sealRestaurantBusinessDay(
      admin,
      PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID,
      day,
    );
    if (!result.ok) {
      console.error(`FAIL ${day}: ${result.code} ${result.message || ''}`);
      fail += 1;
      continue;
    }
    console.log(
      `OK ${day} written=${result.written} revenue=${result.metrics.revenue} guests=${result.metrics.customerCount}`,
    );
  }

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
