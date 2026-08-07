import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  type PermissionDef,
  type PermissionKey,
} from '@/lib/permissions/registry';
import { isPermissionKey } from '@/lib/permissions/registry';
import { enforcePermissionRequires, normalizeStoredPermissions } from '@/lib/permissions/resolve';

/** Top-nav / settings hub entry — sole parent for settings-domain children via `requires`. */
export const SETTINGS_ENTRY_PERMISSION = 'dashboard.settings.view' as const satisfies PermissionKey;

/**
 * Keys that directly list `parent` in `requires` — sole child edge for cascade + settings tree.
 * Do not maintain a parallel parent/children map.
 */
export function permissionDependents(parent: PermissionKey): PermissionKey[] {
  return ALL_PERMISSION_KEYS.filter((key) => {
    const requires = (PERMISSIONS[key] as PermissionDef).requires;
    return Boolean(requires?.some((dep) => dep === parent));
  });
}

/** Settings hub tree children under 餐厅设置 — derived only from `requires`. */
export function settingsPermissionChildren(): PermissionKey[] {
  return permissionDependents(SETTINGS_ENTRY_PERMISSION);
}

/**
 * Save-time close: drop unknown keys, then 补父 (enforce requires).
 * After this, no child can remain without its requires[] (orphan API hole closed by granting parents).
 * Revoke-side 剔子 is `applyPermissionToggle(..., false)` on the client before save.
 */
export function normalizeRolePermissions(raw: unknown): PermissionKey[] {
  return enforcePermissionRequires(normalizeStoredPermissions(raw));
}

/**
 * UI / draft cascade (one toggle path):
 * - enable: add key then 补父
 * - disable: remove key and every transitive dependent (剔子)
 * Checking a parent alone does not auto-enable children.
 */
export function applyPermissionToggle(
  selected: ReadonlySet<PermissionKey>,
  key: PermissionKey,
  enabled: boolean,
): Set<PermissionKey> {
  const next = new Set(selected);
  if (enabled) {
    next.add(key);
    return new Set(enforcePermissionRequires(Array.from(next)));
  }

  const remove = new Set<PermissionKey>([key]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of ALL_PERMISSION_KEYS) {
      if (remove.has(candidate)) continue;
      const requires = (PERMISSIONS[candidate] as PermissionDef).requires;
      if (!requires?.length) continue;
      if (requires.some((dep) => isPermissionKey(dep) && remove.has(dep))) {
        remove.add(candidate);
        changed = true;
      }
    }
  }
  for (const k of Array.from(remove)) next.delete(k);
  return next;
}
