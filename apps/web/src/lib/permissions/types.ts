import type { PermissionKey } from '@/lib/permissions/registry';
import type { RolePresetKey } from '@/lib/permissions/role-templates';

export type OwnerPrincipal = {
  kind: 'owner';
  restaurantId: string;
  userId: string;
};

export type StaffPrincipal = {
  kind: 'staff';
  restaurantId: string;
  userId: string;
  staffAccountId: string;
  roleId: string;
  roleName: string;
  /** Null for custom roles. */
  presetKey: RolePresetKey | null;
  /** Staff row role text for RLS/legacy (`kitchen`…`frontdesk` or `custom`). */
  staffRoleLabel: string;
};

export type Principal = OwnerPrincipal | StaffPrincipal;

export type RestaurantRoleRow = {
  id: string;
  restaurant_id: string;
  name: string;
  preset_key: RolePresetKey | null;
  permissions: PermissionKey[];
  disabled_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
