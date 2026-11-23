import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sole membership (店籍) link for an existing staff account (multi-store plan §3 rule 1, §7, §8.3).
 * Only ops links an account to more stores. Role is picked by name per store; a store without
 * a same-name enabled role is listed before submit and handled one by one (pick / skip).
 * Unlinking reuses `removeStaffMembership` (staff-membership-removal.ts).
 */

export type LinkableRole = {
  id: string;
  name: string;
  preset_key: string | null;
};

export type LinkPlanStore = {
  restaurantId: string;
  roles: readonly LinkableRole[];
  /** The account already has a membership here. */
  linked: boolean;
};

/** Per-store choice for a store with no same-name role: a role id, or skip. */
export type LinkOverride = { roleId: string } | 'skip';

export type LinkPlanRow =
  | { restaurantId: string; status: 'matched' | 'chosen'; roleId: string }
  | { restaurantId: string; status: 'missing' | 'skipped' | 'already_linked' };

function roleNameKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Pure: same-name enabled role (case-insensitive, matches the DB unique lower(name)). */
export function matchRoleByName(
  roles: readonly LinkableRole[],
  roleName: string,
): LinkableRole | null {
  const key = roleNameKey(roleName);
  if (!key) return null;
  return roles.find((r) => roleNameKey(r.name) === key) ?? null;
}

/**
 * Pure preview: which selected stores match the role name, which need a per-store choice
 * (`missing`), which were chosen / skipped, and which are already linked.
 */
export function planStaffMembershipLinks(input: {
  roleName: string;
  stores: readonly LinkPlanStore[];
  overrides?: Readonly<Record<string, LinkOverride>>;
}): LinkPlanRow[] {
  return input.stores.map((store): LinkPlanRow => {
    const { restaurantId } = store;
    if (store.linked) return { restaurantId, status: 'already_linked' };
    const matched = matchRoleByName(store.roles, input.roleName);
    if (matched) return { restaurantId, status: 'matched', roleId: matched.id };
    const override = input.overrides?.[restaurantId];
    if (override === 'skip') return { restaurantId, status: 'skipped' };
    if (override && store.roles.some((r) => r.id === override.roleId)) {
      return { restaurantId, status: 'chosen', roleId: override.roleId };
    }
    return { restaurantId, status: 'missing' };
  });
}

/** Submit is allowed only when every missing store was chosen or skipped and ≥1 store links. */
export function linkPlanReady(rows: readonly LinkPlanRow[]): boolean {
  return (
    rows.some((r) => r.status === 'matched' || r.status === 'chosen') &&
    !rows.some((r) => r.status === 'missing')
  );
}

export type LinkStaffMembershipError =
  | 'already_linked'
  | 'owner_account'
  | 'print_agent_account'
  | 'invalid_role'
  | 'insert_failed';

/** Pure: DB rejection → error code the ops screen can explain (plan §3 DB constraints). */
export function linkStaffMembershipErrorCode(error: {
  code?: string;
  message?: string;
}): LinkStaffMembershipError {
  const message = error.message ?? '';
  if (error.code === '23505') return 'already_linked';
  if (message.includes('staff_user_is_restaurant_owner')) return 'owner_account';
  if (message.includes('print_agent_single_membership')) return 'print_agent_account';
  if (message.includes('staff_role_cannot_become_print_agent')) return 'print_agent_account';
  return 'insert_failed';
}

export type LinkStaffMembershipResult =
  | { ok: true; membershipId: string; roleName: string }
  | { ok: false; error: LinkStaffMembershipError; message?: string };

/**
 * Write one store's membership row for an existing account. The role must be an enabled role
 * of that store; `login_name` is overwritten by the DB mirror trigger from `staff_identities`.
 */
export async function linkStaffMembership(
  admin: SupabaseClient,
  input: {
    restaurantId: string;
    userId: string;
    loginName: string;
    roleId: string;
    displayName: string;
    createdBy: string | null;
  },
): Promise<LinkStaffMembershipResult> {
  const { data: role, error: roleError } = await admin
    .from('restaurant_roles')
    .select('id, name, preset_key, disabled_at')
    .eq('id', input.roleId)
    .eq('restaurant_id', input.restaurantId)
    .maybeSingle();
  if (roleError) return { ok: false, error: 'insert_failed', message: roleError.message };
  if (!role || role.disabled_at) return { ok: false, error: 'invalid_role' };

  const { data, error } = await admin
    .from('restaurant_staff_accounts')
    .insert({
      restaurant_id: input.restaurantId,
      user_id: input.userId,
      role: typeof role.preset_key === 'string' ? role.preset_key : 'custom',
      role_id: role.id,
      display_name: input.displayName,
      login_name: input.loginName,
      created_by: input.createdBy,
    })
    .select('id')
    .single();
  if (error || !data) {
    const err = error ?? { message: 'no_row' };
    return { ok: false, error: linkStaffMembershipErrorCode(err), message: err.message };
  }
  return { ok: true, membershipId: String(data.id), roleName: String(role.name) };
}
