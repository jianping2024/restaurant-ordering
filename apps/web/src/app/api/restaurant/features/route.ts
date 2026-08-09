import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import {
  mergeRestaurantFeatureFlagsJsonb,
  normalizeRestaurantFeatureFlags,
  parseFeatureFlagsPatch,
  parsePrintAgentCredentialTtlDaysPatch,
  resolvePrintAgentCredentialTtlDays,
} from '@/lib/restaurant-features';
import {
  isStationSlipShowCategoryGroupEnabled,
  parseStationSlipShowCategoryGroupPatch,
  hanBitmapFontPxFromConfig,
  parseHanBitmapFontPxPatch,
} from '@/lib/print-agent-config';
import { mergeStoredPrintAgentConfig } from '@/lib/print-agent-config-patch-server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';
import { requirePermission } from '@/lib/permissions/require';
import { isPrintLocale, normalizePrintLocale } from '@/lib/i18n';
import type { PermissionKey } from '@/lib/permissions/registry';

export const runtime = 'nodejs';

const ORDER_COOLDOWN_SECONDS_MIN = 5;
const ORDER_COOLDOWN_SECONDS_MAX = 60;

function featureSettingsResponse(input: {
  featureFlags: unknown;
  printAgentConfig: unknown;
  orderCooldownSeconds: unknown;
  printLocale: string | null | undefined;
}) {
  return {
    flags: normalizeRestaurantFeatureFlags(input.featureFlags),
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(input.printAgentConfig),
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(input.printAgentConfig),
    hanBitmapFontPx: hanBitmapFontPxFromConfig(input.printAgentConfig),
    orderCooldownSeconds: Math.max(
      ORDER_COOLDOWN_SECONDS_MIN,
      Math.min(
        ORDER_COOLDOWN_SECONDS_MAX,
        Number(input.orderCooldownSeconds ?? ORDER_COOLDOWN_SECONDS_MIN),
      ),
    ),
    printLocale: normalizePrintLocale(input.printLocale),
  };
}

function parsePrintLocalePatch(body: unknown): 'pt' | 'en' | 'zh' | undefined | null {
  if (!body || typeof body !== 'object' || !('printLocale' in body)) return undefined;
  const raw = (body as { printLocale?: unknown }).printLocale;
  if (typeof raw !== 'string' || !isPrintLocale(raw)) return null;
  return raw;
}

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
  const permission: PermissionKey = 'settings.features.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data, error } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config, order_cooldown_seconds, print_locale')
    .eq('id', auth.principal.restaurantId)
    .maybeSingle();

  if (error) {
    if (isDbMigrationRequiredError(error)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json(
    featureSettingsResponse({
      featureFlags: data?.feature_flags,
      printAgentConfig: data?.print_agent_config,
      orderCooldownSeconds: data?.order_cooldown_seconds,
      printLocale: data?.print_locale,
    }),
  );
}

export async function PATCH(req: Request) {
  const permission: PermissionKey = 'settings.features.manage';
  const auth = await requirePermission(permission);
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const patch = parseFeatureFlagsPatch(body);
  const credentialTtlDays = parsePrintAgentCredentialTtlDaysPatch(body);
  const stationSlipShowCategoryGroup = parseStationSlipShowCategoryGroupPatch(body);
  const hanBitmapFontPx = parseHanBitmapFontPxPatch(body);
  const orderCooldownSeconds = parseOrderCooldownSecondsPatch(body);
  const printLocale = parsePrintLocalePatch(body);
  if (
    !patch &&
    credentialTtlDays === undefined &&
    stationSlipShowCategoryGroup === undefined &&
    hanBitmapFontPx === undefined &&
    orderCooldownSeconds === undefined &&
    printLocale === undefined
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (credentialTtlDays === null) {
    return NextResponse.json({ error: 'invalid_credential_ttl_days' }, { status: 400 });
  }
  if (stationSlipShowCategoryGroup === null) {
    return NextResponse.json({ error: 'invalid_station_slip_show_category_group' }, { status: 400 });
  }
  if (hanBitmapFontPx === null) {
    return NextResponse.json({ error: 'invalid_han_bitmap_font_px' }, { status: 400 });
  }
  if (orderCooldownSeconds === null) {
    return NextResponse.json({ error: 'invalid_order_cooldown_seconds' }, { status: 400 });
  }
  if (printLocale === null) {
    return NextResponse.json({ error: 'invalid_print_locale' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select('feature_flags, print_agent_config, order_cooldown_seconds, print_locale, suspended_at')
    .eq('id', auth.principal.restaurantId)
    .maybeSingle();

  if (readError) {
    if (isDbMigrationRequiredError(readError)) {
      return NextResponse.json({ error: 'migration_required' }, { status: 503 });
    }
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  if (row?.suspended_at && isRestaurantSuspended(row.suspended_at)) {
    return NextResponse.json({ error: 'restaurant_suspended' }, { status: 403 });
  }

  const nextFlags = patch
    ? normalizeRestaurantFeatureFlags(
        mergeRestaurantFeatureFlagsJsonb(row?.feature_flags, patch),
      )
    : normalizeRestaurantFeatureFlags(row?.feature_flags);
  const nextConfig =
    credentialTtlDays !== undefined ||
    stationSlipShowCategoryGroup !== undefined ||
    hanBitmapFontPx !== undefined
      ? mergeStoredPrintAgentConfig(row?.print_agent_config, {
          ...(credentialTtlDays !== undefined ? { credential_ttl_days: credentialTtlDays } : {}),
          ...(stationSlipShowCategoryGroup !== undefined
            ? { station_slip_show_category_group: stationSlipShowCategoryGroup }
            : {}),
          ...(hanBitmapFontPx !== undefined ? { han_bitmap_font_px: hanBitmapFontPx } : {}),
        })
      : undefined;

  const updatePayload: {
    feature_flags?: Record<string, unknown>;
    print_agent_config?: unknown;
    order_cooldown_seconds?: number;
    print_locale?: 'pt' | 'en' | 'zh';
  } = {};
  if (patch) {
    updatePayload.feature_flags = mergeRestaurantFeatureFlagsJsonb(row?.feature_flags, patch);
  }
  if (nextConfig) updatePayload.print_agent_config = nextConfig;
  if (orderCooldownSeconds !== undefined) {
    updatePayload.order_cooldown_seconds = orderCooldownSeconds;
  }
  if (printLocale !== undefined && printLocale !== null) {
    updatePayload.print_locale = printLocale;
  }

  const { error } = await admin
    .from('restaurants')
    .update(updatePayload)
    .eq('id', auth.principal.restaurantId);

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
    ...featureSettingsResponse({
      featureFlags: nextFlags,
      printAgentConfig: nextConfig ?? row?.print_agent_config,
      orderCooldownSeconds: nextOrderCooldownSeconds,
      printLocale: printLocale ?? row?.print_locale,
    }),
  });
}
