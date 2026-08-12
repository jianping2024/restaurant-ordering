import { NextResponse } from 'next/server';
import { isDbMigrationRequiredError } from '@/lib/db-migration-error';
import {
  OPERATION_LOG_RETENTION_DAYS_MAX,
  OPERATION_LOG_RETENTION_DAYS_MIN,
  resolveOperationLogRetentionDays,
} from '@/lib/operation-logs/retention-days';
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
  kitchenReadyAfterMinutesFromConfig,
  parseKitchenReadyAfterMinutesPatch,
  resolveKitchenReadyAfterMinutes,
} from '@/lib/print-agent-config';
import { mergeStoredPrintAgentConfig } from '@/lib/print-agent-config-patch-server';
import {
  parseSushiRoundSettingsFromRestaurantRow,
  parseSushiRoundSettingsPatch,
  sushiRoundSettingsToApiJson,
  type SushiRoundSettings,
} from '@/lib/table-order-round/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRestaurantSuspended } from '@mesa/shared';
import { requirePermission } from '@/lib/permissions/require';
import { isPrintLocale, normalizePrintLocale } from '@/lib/i18n';
import type { PermissionKey } from '@/lib/permissions/registry';

export const runtime = 'nodejs';

const ORDER_COOLDOWN_SECONDS_MIN = 5;
const ORDER_COOLDOWN_SECONDS_MAX = 60;

const SUSHI_ROUND_SELECT =
  'sushi_round_ordering_enabled, sushi_per_person_per_round_cap, sushi_round_confirm_timeout_seconds, sushi_round_cooldown_seconds, sushi_round_defer_cooldown_seconds';

function featureSettingsResponse(input: {
  featureFlags: unknown;
  printAgentConfig: unknown;
  orderCooldownSeconds: unknown;
  operationLogRetentionDays: unknown;
  printLocale: string | null | undefined;
  sushiRoundSettings: SushiRoundSettings;
}) {
  return {
    flags: normalizeRestaurantFeatureFlags(input.featureFlags),
    credentialTtlDays: resolvePrintAgentCredentialTtlDays(input.printAgentConfig),
    stationSlipShowCategoryGroup: isStationSlipShowCategoryGroupEnabled(input.printAgentConfig),
    hanBitmapFontPx: hanBitmapFontPxFromConfig(input.printAgentConfig),
    kitchenReadyAfterMinutes: kitchenReadyAfterMinutesFromConfig(input.printAgentConfig),
    orderCooldownSeconds: Math.max(
      ORDER_COOLDOWN_SECONDS_MIN,
      Math.min(
        ORDER_COOLDOWN_SECONDS_MAX,
        Number(input.orderCooldownSeconds ?? ORDER_COOLDOWN_SECONDS_MIN),
      ),
    ),
    operationLogRetentionDays: resolveOperationLogRetentionDays(input.operationLogRetentionDays),
    printLocale: normalizePrintLocale(input.printLocale),
    ...sushiRoundSettingsToApiJson(input.sushiRoundSettings),
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

function parseOperationLogRetentionDaysPatch(body: unknown): number | undefined | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const raw = (body as Record<string, unknown>).operationLogRetentionDays;
  if (raw === undefined) return undefined;

  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;

  const rounded = Math.round(n);
  if (
    rounded < OPERATION_LOG_RETENTION_DAYS_MIN ||
    rounded > OPERATION_LOG_RETENTION_DAYS_MAX ||
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
    .select(
      `feature_flags, print_agent_config, order_cooldown_seconds, operation_log_retention_days, print_locale, ${SUSHI_ROUND_SELECT}`,
    )
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
      operationLogRetentionDays: data?.operation_log_retention_days,
      printLocale: data?.print_locale,
      sushiRoundSettings: parseSushiRoundSettingsFromRestaurantRow(data ?? undefined),
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
  const kitchenReadyAfterMinutes = parseKitchenReadyAfterMinutesPatch(body);
  const orderCooldownSeconds = parseOrderCooldownSecondsPatch(body);
  const operationLogRetentionDays = parseOperationLogRetentionDaysPatch(body);
  const printLocale = parsePrintLocalePatch(body);
  const sushiRoundParsed = parseSushiRoundSettingsPatch(body);
  if (!sushiRoundParsed.ok) {
    return NextResponse.json({ error: sushiRoundParsed.error }, { status: 400 });
  }
  const sushiRoundPatch = sushiRoundParsed.patch;
  if (
    !patch &&
    credentialTtlDays === undefined &&
    stationSlipShowCategoryGroup === undefined &&
    hanBitmapFontPx === undefined &&
    orderCooldownSeconds === undefined &&
    operationLogRetentionDays === undefined &&
    printLocale === undefined &&
    kitchenReadyAfterMinutes === undefined &&
    !sushiRoundPatch
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
  if (operationLogRetentionDays === null) {
    return NextResponse.json({ error: 'invalid_operation_log_retention_days' }, { status: 400 });
  }
  if (printLocale === null) {
    return NextResponse.json({ error: 'invalid_print_locale' }, { status: 400 });
  }
  if (kitchenReadyAfterMinutes === null) {
    return NextResponse.json({ error: 'invalid_kitchen_ready_after_minutes' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 503 });
  }

  const { data: row, error: readError } = await admin
    .from('restaurants')
    .select(
      `feature_flags, print_agent_config, order_cooldown_seconds, operation_log_retention_days, print_locale, suspended_at, ${SUSHI_ROUND_SELECT}`,
    )
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
    hanBitmapFontPx !== undefined ||
    kitchenReadyAfterMinutes !== undefined
      ? mergeStoredPrintAgentConfig(row?.print_agent_config, {
          ...(credentialTtlDays !== undefined ? { credential_ttl_days: credentialTtlDays } : {}),
          ...(stationSlipShowCategoryGroup !== undefined
            ? { station_slip_show_category_group: stationSlipShowCategoryGroup }
            : {}),
          ...(hanBitmapFontPx !== undefined ? { han_bitmap_font_px: hanBitmapFontPx } : {}),
          ...(kitchenReadyAfterMinutes !== undefined
            ? {
                kitchen_ready_after_minutes: resolveKitchenReadyAfterMinutes(
                  kitchenReadyAfterMinutes,
                ),
              }
            : {}),
        })
      : undefined;

  const updatePayload: {
    feature_flags?: Record<string, unknown>;
    print_agent_config?: unknown;
    order_cooldown_seconds?: number;
    operation_log_retention_days?: number;
    print_locale?: 'pt' | 'en' | 'zh';
    sushi_round_ordering_enabled?: boolean;
    sushi_per_person_per_round_cap?: number;
    sushi_round_confirm_timeout_seconds?: number;
    sushi_round_cooldown_seconds?: number;
    sushi_round_defer_cooldown_seconds?: number;
  } = {};
  if (patch) {
    updatePayload.feature_flags = mergeRestaurantFeatureFlagsJsonb(row?.feature_flags, patch);
  }
  if (nextConfig) updatePayload.print_agent_config = nextConfig;
  if (orderCooldownSeconds !== undefined) {
    updatePayload.order_cooldown_seconds = orderCooldownSeconds;
  }
  if (operationLogRetentionDays !== undefined) {
    updatePayload.operation_log_retention_days = operationLogRetentionDays;
  }
  if (printLocale !== undefined && printLocale !== null) {
    updatePayload.print_locale = printLocale;
  }
  if (sushiRoundPatch) {
    if (sushiRoundPatch.sushi_round_ordering_enabled !== undefined) {
      updatePayload.sushi_round_ordering_enabled = sushiRoundPatch.sushi_round_ordering_enabled;
    }
    if (sushiRoundPatch.sushi_per_person_per_round_cap !== undefined) {
      updatePayload.sushi_per_person_per_round_cap = sushiRoundPatch.sushi_per_person_per_round_cap;
    }
    if (sushiRoundPatch.sushi_round_confirm_timeout_seconds !== undefined) {
      updatePayload.sushi_round_confirm_timeout_seconds =
        sushiRoundPatch.sushi_round_confirm_timeout_seconds;
    }
    if (sushiRoundPatch.sushi_round_cooldown_seconds !== undefined) {
      updatePayload.sushi_round_cooldown_seconds = sushiRoundPatch.sushi_round_cooldown_seconds;
    }
    if (sushiRoundPatch.sushi_round_defer_cooldown_seconds !== undefined) {
      updatePayload.sushi_round_defer_cooldown_seconds =
        sushiRoundPatch.sushi_round_defer_cooldown_seconds;
    }
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
  const nextOperationLogRetentionDays = resolveOperationLogRetentionDays(
    operationLogRetentionDays ?? row?.operation_log_retention_days,
  );
  const nextSushiRound: SushiRoundSettings = {
    ...parseSushiRoundSettingsFromRestaurantRow(row ?? undefined),
    ...(sushiRoundPatch ?? {}),
  };

  return NextResponse.json({
    ok: true,
    ...featureSettingsResponse({
      featureFlags: nextFlags,
      printAgentConfig: nextConfig ?? row?.print_agent_config,
      orderCooldownSeconds: nextOrderCooldownSeconds,
      operationLogRetentionDays: nextOperationLogRetentionDays,
      printLocale: printLocale ?? row?.print_locale,
      sushiRoundSettings: nextSushiRound,
    }),
  });
}
