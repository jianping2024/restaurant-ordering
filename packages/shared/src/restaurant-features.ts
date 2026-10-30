import type { PremiumKey } from './premium-tier';

/** Known restaurant feature keys — extend this union when adding toggles. */
export type RestaurantFeatureKey =
  | 'bill_receipt_print'
  | 'bill_sync_to_fiscal'
  | 'kitchen_serve_to_table'
  | 'menu_dish_video_enabled'
  | 'menu_flavor_hints_enabled'
  | 'open_table_receipt_print'
  | 'quick_table_close'
  | 'takeaway_ordering';

/** UI grouping by product page / surface area — not stored in jsonb. */
export type RestaurantFeatureModuleId = 'billing' | 'flavor' | 'kitchen' | 'menuDisplay' | 'ordering';

export type RestaurantFeatureFlags = Partial<Record<RestaurantFeatureKey, boolean>>;

export type ResolvedRestaurantFeatureFlags = Record<RestaurantFeatureKey, boolean>;

export type RestaurantFeatureModuleDefinition = {
  id: RestaurantFeatureModuleId;
  labelKey: 'moduleBilling' | 'moduleFlavor' | 'moduleKitchen' | 'moduleMenuDisplay' | 'moduleOrdering';
  sortOrder: number;
};

export type RestaurantFeatureDefinition = {
  key: RestaurantFeatureKey;
  moduleId: RestaurantFeatureModuleId;
  defaultEnabled: boolean;
  labelKey:
    | 'billReceiptPrint'
    | 'billSyncToFiscal'
    | 'kitchenServeToTable'
    | 'menuDishVideo'
    | 'menuFlavorHints'
    | 'openTableReceiptPrint'
    | 'quickTableClose'
    | 'takeawayOrdering';
  descKey:
    | 'billReceiptPrintDesc'
    | 'billSyncToFiscalDesc'
    | 'kitchenServeToTableDesc'
    | 'menuDishVideoDesc'
    | 'menuFlavorHintsDesc'
    | 'openTableReceiptPrintDesc'
    | 'quickTableCloseDesc'
    | 'takeawayOrderingDesc';
  /** Platform Pro gate (`platform_pro_settings.premium_keys`): toggle is locked unless Pro is effective. */
  premiumKey?: PremiumKey;
};

export type RestaurantFeatureModuleGroup = {
  module: RestaurantFeatureModuleDefinition;
  features: readonly RestaurantFeatureDefinition[];
};

/** Retired store flags — stripped on merge so jsonb does not keep a second nav gate. */
const RETIRED_FEATURE_KEYS = ['kitchen_board', 'guest_individual_checkout'] as const;

export const RESTAURANT_FEATURE_MODULES: readonly RestaurantFeatureModuleDefinition[] = [
  { id: 'kitchen', labelKey: 'moduleKitchen', sortOrder: 15 },
  { id: 'billing', labelKey: 'moduleBilling', sortOrder: 20 },
  { id: 'flavor', labelKey: 'moduleFlavor', sortOrder: 25 },
  { id: 'menuDisplay', labelKey: 'moduleMenuDisplay', sortOrder: 27 },
  { id: 'ordering', labelKey: 'moduleOrdering', sortOrder: 30 },
] as const;

export const RESTAURANT_FEATURE_DEFINITIONS: readonly RestaurantFeatureDefinition[] = [
  {
    key: 'kitchen_serve_to_table',
    moduleId: 'kitchen',
    defaultEnabled: false,
    labelKey: 'kitchenServeToTable',
    descKey: 'kitchenServeToTableDesc',
  },
  {
    key: 'bill_receipt_print',
    moduleId: 'billing',
    defaultEnabled: false,
    labelKey: 'billReceiptPrint',
    descKey: 'billReceiptPrintDesc',
  },
  {
    key: 'open_table_receipt_print',
    moduleId: 'billing',
    defaultEnabled: false,
    labelKey: 'openTableReceiptPrint',
    descKey: 'openTableReceiptPrintDesc',
  },
  {
    key: 'bill_sync_to_fiscal',
    moduleId: 'billing',
    defaultEnabled: false,
    labelKey: 'billSyncToFiscal',
    descKey: 'billSyncToFiscalDesc',
  },
  {
    key: 'quick_table_close',
    moduleId: 'billing',
    defaultEnabled: false,
    labelKey: 'quickTableClose',
    descKey: 'quickTableCloseDesc',
  },
  {
    key: 'menu_flavor_hints_enabled',
    moduleId: 'flavor',
    defaultEnabled: false,
    labelKey: 'menuFlavorHints',
    descKey: 'menuFlavorHintsDesc',
  },
  {
    key: 'menu_dish_video_enabled',
    moduleId: 'menuDisplay',
    defaultEnabled: false,
    labelKey: 'menuDishVideo',
    descKey: 'menuDishVideoDesc',
    premiumKey: 'menu_dish_video',
  },
  {
    key: 'takeaway_ordering',
    moduleId: 'ordering',
    defaultEnabled: false,
    labelKey: 'takeawayOrdering',
    descKey: 'takeawayOrderingDesc',
  },
] as const;

const KNOWN_KEYS = new Set<string>(RESTAURANT_FEATURE_DEFINITIONS.map((d) => d.key));

const MODULE_BY_ID = new Map(
  RESTAURANT_FEATURE_MODULES.map((module) => [module.id, module] as const),
);

export function groupRestaurantFeaturesByModule(): RestaurantFeatureModuleGroup[] {
  const sortedModules = [...RESTAURANT_FEATURE_MODULES].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );

  return sortedModules
    .map((module) => ({
      module,
      features: RESTAURANT_FEATURE_DEFINITIONS.filter((def) => def.moduleId === module.id),
    }))
    .filter((group) => group.features.length > 0);
}

/**
 * Sole host for these modules: Dashboard「打印设置」(`/dashboard/settings/print-assistant`).
 * Not rendered on「功能管理」.
 */
export const PRINT_SETTINGS_FEATURE_MODULE_IDS = ['billing'] as const satisfies readonly RestaurantFeatureModuleId[];

const PRINT_SETTINGS_MODULE_ID_SET = new Set<string>(PRINT_SETTINGS_FEATURE_MODULE_IDS);

export function isPrintSettingsFeatureModuleId(moduleId: RestaurantFeatureModuleId): boolean {
  return PRINT_SETTINGS_MODULE_ID_SET.has(moduleId);
}

export function isPrintSettingsFeatureKey(key: RestaurantFeatureKey): boolean {
  const def = RESTAURANT_FEATURE_DEFINITIONS.find((d) => d.key === key);
  return def != null && isPrintSettingsFeatureModuleId(def.moduleId);
}

/** Flags for one save body — print page sends billing only; features page omits billing. */
export function pickRestaurantFeatureFlagsForModules(
  flags: ResolvedRestaurantFeatureFlags,
  moduleIds: readonly RestaurantFeatureModuleId[],
): RestaurantFeatureFlags {
  const idSet = new Set<string>(moduleIds);
  const out: RestaurantFeatureFlags = {};
  for (const def of RESTAURANT_FEATURE_DEFINITIONS) {
    if (idSet.has(def.moduleId)) {
      out[def.key] = flags[def.key];
    }
  }
  return out;
}

export function featureFlagsPatchTouchesPrintSettings(patch: RestaurantFeatureFlags): boolean {
  return (Object.keys(patch) as RestaurantFeatureKey[]).some((key) =>
    isPrintSettingsFeatureKey(key),
  );
}

export function featureFlagsPatchTouchesNonPrintSettings(patch: RestaurantFeatureFlags): boolean {
  return (Object.keys(patch) as RestaurantFeatureKey[]).some(
    (key) => !isPrintSettingsFeatureKey(key),
  );
}

export function groupRestaurantFeaturesForPrintSettings(): RestaurantFeatureModuleGroup[] {
  return groupRestaurantFeaturesByModule().filter((group) =>
    isPrintSettingsFeatureModuleId(group.module.id),
  );
}

export function groupRestaurantFeaturesForFeatureSettings(): RestaurantFeatureModuleGroup[] {
  return groupRestaurantFeaturesByModule().filter(
    (group) => !isPrintSettingsFeatureModuleId(group.module.id),
  );
}

export function getRestaurantFeatureModule(
  moduleId: RestaurantFeatureModuleId,
): RestaurantFeatureModuleDefinition {
  const featureModule = MODULE_BY_ID.get(moduleId);
  if (!featureModule) {
    throw new Error(`Unknown restaurant feature module: ${moduleId}`);
  }
  return featureModule;
}

export function normalizeRestaurantFeatureFlags(raw: unknown): ResolvedRestaurantFeatureFlags {
  const stored =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const result = {} as ResolvedRestaurantFeatureFlags;
  for (const def of RESTAURANT_FEATURE_DEFINITIONS) {
    const value = stored[def.key];
    result[def.key] = typeof value === 'boolean' ? value : def.defaultEnabled;
  }
  return result;
}

export function isRestaurantFeatureEnabled(
  flags: unknown,
  key: RestaurantFeatureKey,
): boolean {
  return normalizeRestaurantFeatureFlags(flags)[key];
}

/**
 * Sole mutual exclusion: 快速关台 ↔ 打印发票.
 * Enabling one in the patch turns the other off; if both end up true without an
 * explicit enable in this patch (corrupt store), keep 打印发票 and turn off 快速关台.
 */
export function applyBillingCheckoutModeExclusions(
  flags: ResolvedRestaurantFeatureFlags,
  patch: RestaurantFeatureFlags,
): ResolvedRestaurantFeatureFlags {
  const next = { ...flags };
  if (patch.quick_table_close === true) {
    next.quick_table_close = true;
    next.bill_sync_to_fiscal = false;
    return next;
  }
  if (patch.bill_sync_to_fiscal === true) {
    next.bill_sync_to_fiscal = true;
    next.quick_table_close = false;
    return next;
  }
  if (next.quick_table_close && next.bill_sync_to_fiscal) {
    next.quick_table_close = false;
  }
  return next;
}

export function parseFeatureFlagsPatch(body: unknown): RestaurantFeatureFlags | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const flags = (body as Record<string, unknown>).flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return null;

  const patch: RestaurantFeatureFlags = {};
  for (const [key, value] of Object.entries(flags as Record<string, unknown>)) {
    if (!KNOWN_KEYS.has(key)) continue;
    if (typeof value !== 'boolean') return null;
    patch[key as RestaurantFeatureKey] = value;
  }
  return patch;
}

export function parseFeatureFlagsRecord(raw: unknown): RestaurantFeatureFlags | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const patch: RestaurantFeatureFlags = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!KNOWN_KEYS.has(key)) continue;
    if (typeof value !== 'boolean') return null;
    patch[key as RestaurantFeatureKey] = value;
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function cloneFeatureFlagsRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
}

/** Merge registry flags into stored jsonb; preserves keys managed elsewhere (e.g. geo_order_restriction). */
export function mergeRestaurantFeatureFlagsJsonb(
  current: unknown,
  patch: RestaurantFeatureFlags,
): Record<string, unknown> {
  const base = cloneFeatureFlagsRecord(current);
  const normalized = normalizeRestaurantFeatureFlags(current);
  for (const def of RESTAURANT_FEATURE_DEFINITIONS) {
    base[def.key] = patch[def.key] ?? normalized[def.key];
  }
  const exclusive = applyBillingCheckoutModeExclusions(
    normalizeRestaurantFeatureFlags(base),
    patch,
  );
  for (const def of RESTAURANT_FEATURE_DEFINITIONS) {
    base[def.key] = exclusive[def.key];
  }
  for (const key of RETIRED_FEATURE_KEYS) {
    delete base[key];
  }
  return base;
}

export function mergeRestaurantFeatureFlags(
  current: unknown,
  patch: RestaurantFeatureFlags,
): ResolvedRestaurantFeatureFlags {
  return normalizeRestaurantFeatureFlags(mergeRestaurantFeatureFlagsJsonb(current, patch));
}
