import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import {
  mergeRestaurantFeatureFlags,
  normalizeRestaurantFeatureFlags,
  parseFeatureFlagsPatch,
  parsePrintAgentCredentialTtlDaysPatch,
  resolvePrintAgentCredentialTtlDays,
} from '@/lib/restaurant-features';
import {
  isStationSlipShowCategoryGroupEnabled,
  normalizePrintAgentCloudConfig,
  parseStationSlipShowCategoryGroupPatch,
} from '@/lib/print-agent-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { getOwnerRestaurantId } from '@/lib/print-agent-dashboard-auth';

export const runtime = 'nodejs';

const ORDER_COOLDOWN_SECONDS_MIN = 5;
const ORDER_COOLDOWN_SECONDS_MAX = 60;

function parseOrderCooldownSecondsPatch(body: unknown): number | undefined | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const raw = (body as Record<string, unknown>).orderCooldownSeconds;
  if (raw === undefined) return undefined;

  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;

  const rounded = Math.round(n);
  if (
    rounded < ORDER_COOLDOWN_SECONDS_MIN ||
    rounded > ORDER_COOLDOWN_SECONDS_MAX ||
    !Number.isInteger(rounded)
  ) {
    return null;
  }

  return rounded;
}

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
    .select('feature_flags, print_agent_config, order_cooldown_seconds')
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
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(data?.print_agent_config),
    orderCooldownSeconds: Math.max(
      ORDER_COOLDOWN_SECONDS_MIN,
      Math.min(
        ORDER_COOLDOWN_SECONDS_MAX,
        Number(data?.order_cooldown_seconds ?? ORDER_COOLDOWN_SECONDS_MIN),
      ),
    ),
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
  const stationSlipShowCategoryGroup = parseStationSlipShowCategoryGroupPatch(body);
  const orderCooldownSeconds = parseOrderCooldownSecondsPatch(body);
  if (
    !patch &&
    credentialTtlDays === undefined &&
    stationSlipShowCategoryGroup === undefined &&
    orderCooldownSeconds === undefined
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (credentialTtlDays === null) {
    return NextResponse.json({ error: 'invalid_credential_ttl_days' }, { status: 400 });
  }
  if (stationSlipShowCategoryGroup === null) {
    return NextResponse.json({ error: 'invalid_station_slip_show_category_group' }, { status: 400 });
  }
  if (orderCooldownSeconds === null) {
    return NextResponse.json({ error: 'invalid_order_cooldown_seconds' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config, order_cooldown_seconds')
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
  const baseConfig = normalizePrintAgentCloudConfig(row?.print_agent_config);
  const nextConfig =
    credentialTtlDays !== undefined || stationSlipShowCategoryGroup !== undefined
      ? {
          ...baseConfig,
          ...(credentialTtlDays !== undefined ? { credential_ttl_days: credentialTtlDays } : {}),
          ...(stationSlipShowCategoryGroup !== undefined
            ? {
                station_slip_show_category_group: stationSlipShowCategoryGroup ? true : undefined,
              }
            : {}),
        }
      : undefined;

  const updatePayload: {
    feature_flags?: typeof nextFlags;
    print_agent_config?: unknown;
    order_cooldown_seconds?: number;
  } = {};
  if (patch) updatePayload.feature_flags = nextFlags;
  if (nextConfig) updatePayload.print_agent_config = nextConfig;
  if (orderCooldownSeconds !== undefined) {
    updatePayload.order_cooldown_seconds = orderCooldownSeconds;
  }

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

  const nextOrderCooldownSeconds =
    orderCooldownSeconds ??
    Number(row?.order_cooldown_seconds ?? ORDER_COOLDOWN_SECONDS_MIN);

  return NextResponse.json({
    ok: true,
    flags: nextFlags,
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(
      nextConfig ?? row?.print_agent_config,
    ),
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(
      nextConfig ?? row?.print_agent_config,
    ),
    orderCooldownSeconds: Math.max(
      ORDER_COOLDOWN_SECONDS_MIN,
      Math.min(ORDER_COOLDOWN_SECONDS_MAX, nextOrderCooldownSeconds),
    ),
  });
}
