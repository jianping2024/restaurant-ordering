/** Known restaurant feature keys — extend this union when adding toggles. */
export type RestaurantFeatureKey = 'bill_receipt_print' | 'kitchen_serve_to_table';

/** UI grouping by product page / surface area — not stored in jsonb. */
export type RestaurantFeatureModuleId = 'billing' | 'kitchen';

export type RestaurantFeatureFlags = Partial<Record<RestaurantFeatureKey, boolean>>;

export type ResolvedRestaurantFeatureFlags = Record<RestaurantFeatureKey, boolean>;

export type RestaurantFeatureModuleDefinition = {
  id: RestaurantFeatureModuleId;
  labelKey: 'moduleBilling' | 'moduleKitchen';
  sortOrder: number;
};

export type RestaurantFeatureDefinition = {
  key: RestaurantFeatureKey;
  moduleId: RestaurantFeatureModuleId;
  defaultEnabled: boolean;
  labelKey: 'billReceiptPrint' | 'kitchenServeToTable';
  descKey: 'billReceiptPrintDesc' | 'kitchenServeToTableDesc';
};

export type RestaurantFeatureModuleGroup = {
  module: RestaurantFeatureModuleDefinition;
  features: readonly RestaurantFeatureDefinition[];
};

/** Retired store flags — stripped on merge so jsonb does not keep a second nav gate. */
const RETIRED_FEATURE_KEYS = ['kitchen_board'] as const;

export const RESTAURANT_FEATURE_MODULES: readonly RestaurantFeatureModuleDefinition[] = [
  { id: 'kitchen', labelKey: 'moduleKitchen', sortOrder: 15 },
  { id: 'billing', labelKey: 'moduleBilling', sortOrder: 20 },
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
