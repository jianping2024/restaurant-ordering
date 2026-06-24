import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import {
  mergeRestaurantFeatureFlags,
  normalizeRestaurantFeatureFlags,
  parseFeatureFlagsPatch,
  parsePrintAgentCredentialTtlDaysPatch,
  resolvePrintAgentCredentialTtlDays,
} from '@/lib/restaurant-features';
import { normalizePrintAgentCloudConfig } from '@/lib/print-agent-config';
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
    .select('feature_flags, print_agent_config')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({
    flags: normalizeRestaurantFeatureFlags(data?.feature_flags),
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(data?.print_agent_config),
  });
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
  const credentialTtlDays = parsePrintAgentCredentialTtlDaysPatch(body);
  if (!patch && credentialTtlDays === undefined) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (credentialTtlDays === null) {
    return NextResponse.json({ error: 'invalid_credential_ttl_days' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config')
    .eq('id', auth.restaurantId)
    .maybeSingle();

  if (readError) {
    if (isDbMigrationRequiredError(readError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const nextFlags = patch
    ? mergeRestaurantFeatureFlags(row?.feature_flags, patch)
    : normalizeRestaurantFeatureFlags(row?.feature_flags);
  const nextConfig =
    credentialTtlDays !== undefined
      ? {
          ...normalizePrintAgentCloudConfig(row?.print_agent_config),
          credential_ttl_days: credentialTtlDays,
        }
      : undefined;

  const updatePayload: { feature_flags?: typeof nextFlags; print_agent_config?: unknown } = {};
  if (patch) updatePayload.feature_flags = nextFlags;
  if (nextConfig) updatePayload.print_agent_config = nextConfig;

  const { error } = await admin
    .from('restaurants')
    .update(updatePayload)
    .eq('id', auth.restaurantId);

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'update_failed', message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    flags: nextFlags,
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(
      nextConfig ?? row?.print_agent_config,
    ),
  });
}
