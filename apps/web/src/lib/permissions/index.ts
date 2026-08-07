export type { PermissionKey, PermissionGroup, PermissionDef } from '@/lib/permissions/registry';
export {
  PERMISSIONS,
  ALL_PERMISSION_KEYS,
  isPermissionKey,
  NAV_PERMISSION,
  DASHBOARD_ROUTE_PERMISSIONS,
  dashboardRoutePermission,
} from '@/lib/permissions/registry';

export type { Capabilities } from '@/lib/permissions/can';
export { can, canAny, capabilitiesFromKeys } from '@/lib/permissions/can';

export type { RolePresetKey } from '@/lib/permissions/role-templates';
export {
  ROLE_PRESET_KEYS,
  ROLE_PRESET_DEFAULT_NAMES,
  ROLE_TEMPLATES,
  isRolePresetKey,
  templatePermissions,
} from '@/lib/permissions/role-templates';

export type {
  Principal,
  OwnerPrincipal,
  StaffPrincipal,
  RestaurantRoleRow,
} from '@/lib/permissions/types';

export {
  normalizeStoredPermissions,
  enforcePermissionRequires,
  resolveCapabilitiesForOwner,
  resolveCapabilitiesFromRolePermissions,
  floorBoardCapabilitiesFromCaps,
  mayForceCloseFromCaps,
  staffLandingPathFromCapabilities,
  type FloorBoardCapabilities,
} from '@/lib/permissions/resolve';

export {
  SETTINGS_ENTRY_PERMISSION,
  permissionDependents,
  settingsPermissionChildren,
  normalizeRolePermissions,
  applyPermissionToggle,
} from '@/lib/permissions/role-permission-set';

export {
  ensureRestaurantPresetRoles,
  listRestaurantRoles,
  getRestaurantRole,
  findPresetRole,
  createRestaurantRole,
  updateRestaurantRole,
  deleteRestaurantRole,
  countStaffOnRole,
  staffRoleLabelForRestaurantRole,
} from '@/lib/permissions/restaurant-roles';

export {
  loadStaffCapabilitiesForGateAccount,
  resolveStaffLandingPath,
} from '@/lib/permissions/staff-landing';
export { loadPrincipal, loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
export type { PrincipalWithCapabilities } from '@/lib/permissions/principal';

export {
  requirePermission,
  requireAnyPermission,
  assertCapability,
  type PermissionOk,
} from '@/lib/permissions/require';
