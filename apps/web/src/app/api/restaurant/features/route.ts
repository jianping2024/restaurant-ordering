import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import {
  mergeRestaurantFeatureFlags,
  normalizeRestaurantFeatureFlags,
  parseFeatureFlagsPatch,
} from '@/lib/restaurant-features';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await getOwnerRestaurantId();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('restaurants')
    .select('feature_flags')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({ flags: normalizeRestaurantFeatureFlags(data?.feature_flags) });
}

export async function PATCH(req: Request) {
  const auth = await getOwnerRestaurantId({ requireWritable: true });
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch = parseFeatureFlagsPatch(body);
  if (!patch) {
    return NextResponse.json({ error: 'invalid_flags' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select('feature_flags')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (readError) {
    if (isDbMigrationRequiredError(readError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const nextFlags = mergeRestaurantFeatureFlags(row?.feature_flags, patch);

  const { error } = await admin
    .from('restaurants')
    .update({ feature_flags: nextFlags })
    .eq('id', auth.restaurantId);

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, flags: nextFlags });
}
