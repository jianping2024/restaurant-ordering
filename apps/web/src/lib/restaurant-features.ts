/** Known restaurant feature keys — extend this union when adding toggles. */
export type RestaurantFeatureKey = 'kitchen_board';

/** UI grouping by product page / surface area — not stored in jsonb. */
export type RestaurantFeatureModuleId = 'dashboard_nav';

export type RestaurantFeatureFlags = Partial<Record<RestaurantFeatureKey, boolean>>;

export type ResolvedRestaurantFeatureFlags = Record<RestaurantFeatureKey, boolean>;

export type RestaurantFeatureModuleDefinition = {
  id: RestaurantFeatureModuleId;
  labelKey: 'moduleDashboardNav';
  /** Lower values render first on the settings page. */
  sortOrder: number;
};

export type RestaurantFeatureDefinition = {
  key: RestaurantFeatureKey;
  moduleId: RestaurantFeatureModuleId;
  /** Used when the key is absent from stored jsonb. */
  defaultEnabled: boolean;
  labelKey: 'kitchenBoard';
  descKey: 'kitchenBoardDesc';
  /** Which dashboard sidebar shortcut this feature controls. */
  dashboardShortcut?: 'kitchen';
};

export type RestaurantFeatureModuleGroup = {
  module: RestaurantFeatureModuleDefinition;
  features: readonly RestaurantFeatureDefinition[];
};

/** Page/module taxonomy for the settings UI and future nav gating. */
export const RESTAURANT_FEATURE_MODULES: readonly RestaurantFeatureModuleDefinition[] = [
  {
    id: 'dashboard_nav',
    labelKey: 'moduleDashboardNav',
    sortOrder: 10,
  },
] as const;

/** Single registry for UI, API validation, and nav gating. */
export const RESTAURANT_FEATURE_DEFINITIONS: readonly RestaurantFeatureDefinition[] = [
  {
    key: 'kitchen_board',
    moduleId: 'dashboard_nav',
    defaultEnabled: false,
    labelKey: 'kitchenBoard',
    descKey: 'kitchenBoardDesc',
    dashboardShortcut: 'kitchen',
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

export function mergeRestaurantFeatureFlags(
  current: unknown,
  patch: RestaurantFeatureFlags,
): ResolvedRestaurantFeatureFlags {
  return { ...normalizeRestaurantFeatureFlags(current), ...patch };
}

export function isDashboardKitchenShortcutEnabled(flags: unknown): boolean {
  return isRestaurantFeatureEnabled(flags, 'kitchen_board');
}
