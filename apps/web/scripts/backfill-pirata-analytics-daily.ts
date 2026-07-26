import { createClient } from '@supabase/supabase-js';
import { sealRestaurantBusinessDay } from '@/lib/analytics/daily-stats';
import { PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID } from '@/lib/analytics/analytics.types';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/lisbon-calendar';

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
  const days: string[] = [];
  for (let i = 30; i >= 1; i -= 1) {
    days.push(addCalendarDays(today, -i));
  }

  console.log(
    `Sealing ${days.length} days for Pirata ${PIRATA_ANALYTICS_BACKFILL_RESTAURANT_ID} (today=${today})`,
  );

  let fail = 0;
  for (const day of days) {
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
      `OK ${day} revenue=${result.metrics.revenue} guests=${result.metrics.customerCount} sessions=${result.metrics.qualifyingSessionCount}`,
    );
  }

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
