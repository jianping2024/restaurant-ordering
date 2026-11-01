/**
 * Sole Pro gate for role-editor checkbox visibility + save-time preserve.
 * Registry `premiumKey` is the only place a permission declares a Pro parent.
 */
import { canUsePremiumFeature, type PremiumKey } from '@mesa/shared';
import {
  ALL_PERMISSION_KEYS,
  PERMISSIONS,
  type PermissionDef,
  type PermissionKey,
  isPermissionKey,
} from '@/lib/permissions/registry';
import type { PermissionTreeNode } from '@/lib/permissions/permission-page-tree';
import { enforcePermissionRequires, normalizeStoredPermissions } from '@/lib/permissions/resolve';

export type PermissionPremiumTierFields = {
  plan?: string | null;
  pro_valid_until?: string | null;
  license_valid_until?: string | null;
};

/** Permission keys whose registry `premiumKey` is not effective for this restaurant. */
export function permissionKeysHiddenWithoutPremium(
  restaurant: PermissionPremiumTierFields,
  entitledKeys: readonly PremiumKey[],
  now = new Date(),
): PermissionKey[] {
  return ALL_PERMISSION_KEYS.filter((key) => {
    const premiumKey = (PERMISSIONS[key] as PermissionDef).premiumKey;
    if (!premiumKey) return false;
    return !canUsePremiumFeature({
      premiumKey,
      entitledKeys,
      plan: restaurant.plan,
      proValidUntil: restaurant.pro_valid_until,
      licenseValidUntil: restaurant.license_valid_until,
      now,
    });
  });
}

/** Drop hidden keys from the editor tree; parents stay even if all children are hidden. */
export function filterPermissionTreeByHiddenKeys(
  nodes: readonly PermissionTreeNode[],
  hiddenKeys: ReadonlySet<PermissionKey>,
): PermissionTreeNode[] {
  const out: PermissionTreeNode[] = [];
  for (const node of nodes) {
    if (hiddenKeys.has(node.permission)) continue;
    const children = node.children?.length
      ? filterPermissionTreeByHiddenKeys(node.children, hiddenKeys)
      : undefined;
    out.push(children ? { ...node, children } : node);
  }
  return out;
}

/**
 * When Pro is off, the editor hides premium checkboxes but must not wipe stored grants.
 * Re-add each hidden key that the role already had, only if its `requires` parents
 * are still in the incoming set (parent revoke still cascades).
 */
export function mergePreservedHiddenPermissions(
  incoming: readonly PermissionKey[],
  existing: readonly PermissionKey[],
  hiddenKeys: ReadonlySet<PermissionKey>,
): PermissionKey[] {
  const next = new Set(normalizeStoredPermissions(incoming));
  const existingSet = new Set(normalizeStoredPermissions(existing));
  for (const key of Array.from(hiddenKeys)) {
    if (!existingSet.has(key)) continue;
    const requires = (PERMISSIONS[key] as PermissionDef).requires ?? [];
    const parentsOk = requires.every((dep) => isPermissionKey(dep) && next.has(dep));
    if (parentsOk) next.add(key);
  }
  return enforcePermissionRequires(Array.from(next));
}
