import {
  ROLE_PRESET_DEFAULT_NAMES,
  ROLE_PRESET_KEYS,
  ROLE_TEMPLATES as SHARED_ROLE_TEMPLATES,
  isRolePresetKey,
  templatePermissions as sharedTemplatePermissions,
  type RolePresetKey,
} from '@mesa/shared';
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey,
} from '@/lib/permissions/registry';

export type { RolePresetKey };
export { ROLE_PRESET_KEYS, ROLE_PRESET_DEFAULT_NAMES, isRolePresetKey };

/**
 * Sole default permission matrix — frozen from Pirata (`@mesa/shared` ROLE_TEMPLATES).
 * Seeded onto restaurant_roles.permissions; edits overwrite the full array (one representation).
 */
export const ROLE_TEMPLATES = SHARED_ROLE_TEMPLATES as Record<
  RolePresetKey,
  readonly PermissionKey[]
>;

export function templatePermissions(preset: RolePresetKey): PermissionKey[] {
  return sharedTemplatePermissions(preset) as PermissionKey[];
}

export function assertTemplateKeysValid(): void {
  const known = new Set(ALL_PERMISSION_KEYS);
  for (const preset of ROLE_PRESET_KEYS) {
    for (const key of ROLE_TEMPLATES[preset]) {
      if (!known.has(key)) {
        throw new Error(`ROLE_TEMPLATES[${preset}] unknown key: ${key}`);
      }
    }
  }
}
