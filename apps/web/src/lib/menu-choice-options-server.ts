import type { AuthorizedRestaurantId } from '@/lib/permissions/authorized-restaurant-id';
import type { SupabaseClient } from '@supabase/supabase-js';
import { invalidateCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import {
  normalizeChoiceBindings,
  parseMenuChoiceNameFields,
  type MenuChoiceGroup,
  type MenuChoiceNameFields,
  type MenuChoiceOption,
} from '@/lib/menu-choice-options';
import { parseTableIdParam } from '@/lib/restaurant-tables';

export type MenuChoiceMutationError = {
  error: string;
  message?: string;
  status: number;
  referenced_item_count?: number;
};

export function parseChoiceNameBody(
  body: Record<string, unknown>,
): MenuChoiceNameFields | MenuChoiceMutationError {
  const fields = parseMenuChoiceNameFields(body);
  if ('error' in fields) return fields;
  return fields;
}

async function nextGroupSortOrder(admin: SupabaseClient, restaurantId: AuthorizedRestaurantId): Promise<number> {
  const { data } = await admin
    .from('menu_choice_groups')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const top = data?.[0]?.sort_order;
  return typeof top === 'number' ? top + 1 : 0;
}

async function nextOptionSortOrder(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  groupId: string,
): Promise<number> {
  const { data } = await admin
    .from('menu_choice_options')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const top = data?.[0]?.sort_order;
  return typeof top === 'number' ? top + 1 : 0;
}

export async function listMenuChoiceDictionary(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<
  | { groups: MenuChoiceGroup[]; options: MenuChoiceOption[] }
  | MenuChoiceMutationError
> {
  const [gRes, oRes] = await Promise.all([
    admin
      .from('menu_choice_groups')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    admin
      .from('menu_choice_options')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  if (gRes.error) {
    return { error: 'choice_list_failed', message: gRes.error.message, status: 500 };
  }
  if (oRes.error) {
    return { error: 'choice_list_failed', message: oRes.error.message, status: 500 };
  }
  return {
    groups: (gRes.data ?? []) as MenuChoiceGroup[],
    options: (oRes.data ?? []) as MenuChoiceOption[],
  };
}

export async function createMenuChoiceGroup(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  fields: MenuChoiceNameFields,
): Promise<{ group: MenuChoiceGroup } | MenuChoiceMutationError> {
  const sort_order = await nextGroupSortOrder(admin, restaurantId);
  const { data, error } = await admin
    .from('menu_choice_groups')
    .insert({
      restaurant_id: restaurantId,
      name_en: fields.name_en,
      name_pt: fields.name_pt,
      name_zh: fields.name_zh,
      sort_order,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'choice_group_create_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { group: data as MenuChoiceGroup };
}

export async function updateMenuChoiceGroup(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  groupId: string,
  patch: Partial<MenuChoiceNameFields> & { active?: boolean },
): Promise<{ group: MenuChoiceGroup } | MenuChoiceMutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_choice_group_id', status: 400 };
  const { data, error } = await admin
    .from('menu_choice_groups')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'choice_group_update_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { group: data as MenuChoiceGroup };
}

/**
 * Delete a choice group when no dish binds it.
 * Bound dishes (choice_bindings.group_id) → 409 choice_group_in_use.
 * Unbound → delete options first (FK RESTRICT), then the group.
 */
export async function deleteMenuChoiceGroup(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  groupId: string,
): Promise<{ ok: true } | MenuChoiceMutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_choice_group_id', status: 400 };

  const { data: itemRows, error: itemsError } = await admin
    .from('menu_items')
    .select('id, choice_bindings')
    .eq('restaurant_id', restaurantId);
  if (itemsError) {
    return { error: 'choice_group_delete_failed', message: itemsError.message, status: 500 };
  }
  const boundCount = (itemRows ?? []).filter((row) =>
    normalizeChoiceBindings(row.choice_bindings).some((b) => b.group_id === id),
  ).length;
  if (boundCount > 0) {
    return {
      error: 'choice_group_in_use',
      status: 409,
      referenced_item_count: boundCount,
    };
  }

  const { error: optionsError } = await admin
    .from('menu_choice_options')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('group_id', id);
  if (optionsError) {
    return { error: 'choice_group_delete_failed', message: optionsError.message, status: 500 };
  }

  const { error, count: deleted } = await admin
    .from('menu_choice_groups')
    .delete({ count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('id', id);
  if (error) {
    return { error: 'choice_group_delete_failed', message: error.message, status: 500 };
  }
  if (!deleted) return { error: 'choice_group_not_found', status: 404 };
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function createMenuChoiceOption(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  groupId: string,
  fields: MenuChoiceNameFields,
): Promise<{ option: MenuChoiceOption } | MenuChoiceMutationError> {
  const gid = parseTableIdParam(groupId);
  if (!gid) return { error: 'invalid_choice_group_id', status: 400 };
  const sort_order = await nextOptionSortOrder(admin, restaurantId, gid);
  const { data, error } = await admin
    .from('menu_choice_options')
    .insert({
      restaurant_id: restaurantId,
      group_id: gid,
      name_en: fields.name_en,
      name_pt: fields.name_pt,
      name_zh: fields.name_zh,
      sort_order,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'choice_option_create_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { option: data as MenuChoiceOption };
}

export async function updateMenuChoiceOption(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  optionId: string,
  patch: Partial<MenuChoiceNameFields> & { active?: boolean },
): Promise<{ option: MenuChoiceOption } | MenuChoiceMutationError> {
  const id = parseTableIdParam(optionId);
  if (!id) return { error: 'invalid_choice_option_id', status: 400 };
  const { data, error } = await admin
    .from('menu_choice_options')
    .update(patch)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'choice_option_update_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { option: data as MenuChoiceOption };
}

export async function deleteMenuChoiceOption(
  admin: SupabaseClient,
  restaurantId: AuthorizedRestaurantId,
  optionId: string,
): Promise<{ ok: true } | MenuChoiceMutationError> {
  const id = parseTableIdParam(optionId);
  if (!id) return { error: 'invalid_choice_option_id', status: 400 };
  const { error } = await admin
    .from('menu_choice_options')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('id', id);
  if (error) {
    return { error: 'choice_option_delete_failed', message: error.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}
