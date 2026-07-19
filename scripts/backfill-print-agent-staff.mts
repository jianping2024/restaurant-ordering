#!/usr/bin/env node
/**
 * One-shot backfill: ensure print_agent staff exists for every restaurant.
 *
 * Usage (from repo root, with env loaded):
 *   node --env-file=apps/web/.env.local --import tsx scripts/backfill-print-agent-staff.mts
 */
import { createClient } from '@supabase/supabase-js';
import { ensurePrintAgentStaff } from '../packages/shared/src/print-agent-staff.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: restaurants, error } = await admin
  .from('restaurants')
  .select('id, slug')
  .order('created_at', { ascending: true });

if (error) {
  console.error('list restaurants failed', error.message);
  process.exit(1);
}

let ok = 0;
let fail = 0;
for (const r of restaurants || []) {
  const result = await ensurePrintAgentStaff(admin, {
    restaurantId: r.id as string,
    restaurantSlug: r.slug as string,
  });
  if (result.ok) {
    ok += 1;
    console.log(`ok ${r.slug} ${result.accountId}`);
  } else {
    fail += 1;
    console.error(`fail ${r.slug} ${result.error} ${result.detail || ''}`);
  }
}

console.log(`done ok=${ok} fail=${fail}`);
process.exit(fail > 0 ? 1 : 0);
