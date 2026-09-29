import type { SupabaseClient } from '@supabase/supabase-js';
import {
  orderedIdsMatchSiblingSet,
  permuteSortOrderAssignments,
} from '@/lib/sort-order';
import { invalidateCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  parseMenuNotePresetNameFields,
  parseOrderedIds,
  type MenuNotePreset,
  type MenuNotePresetGroup,
  type MenuNotePresetNameFields,
} from '@/lib/menu-note-presets';
import { type MenuNotePresetQueryError } from '@/lib/menu-note-presets-query';

export {
  listMenuNotePresetDictionary,
  listRestaurantNotePresetGroupIds,
} from '@/lib/menu-note-presets-query';

export type MenuNotePresetMutationError = MenuNotePresetQueryError & {
  referenced_item_count?: number;
};

export async function seedDefaultMenuNotePresets(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<{ ok: true } | MenuNotePresetMutationError> {
  const { error } = await admin.rpc('seed_default_menu_note_presets', {
    p_restaurant_id: restaurantId,
  });
  if (error) {
    return { error: 'note_preset_seed_failed', message: error.message, status: 500 };
  }
  return { ok: true };
}

async function nextGroupSortOrder(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const { data } = await admin
    .from('menu_note_preset_groups')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const top = data?.[0]?.sort_order;
  return typeof top === 'number' ? top + 1 : 0;
}

async function nextPresetSortOrder(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
): Promise<number> {
  const { data } = await admin
    .from('menu_note_presets')
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .eq('group_id', groupId)
    .order('sort_order', { ascending: false })
    .limit(1);
  const top = data?.[0]?.sort_order;
  return typeof top === 'number' ? top + 1 : 0;
}

export async function createMenuNotePresetGroup(
  admin: SupabaseClient,
  restaurantId: string,
  fields: MenuNotePresetNameFields,
): Promise<{ group: MenuNotePresetGroup } | MenuNotePresetMutationError> {
  const sort_order = await nextGroupSortOrder(admin, restaurantId);
  const { data, error } = await admin
    .from('menu_note_preset_groups')
    .insert({
      restaurant_id: restaurantId,
      name_en: fields.name_en,
      name_pt: fields.name_pt,
      name_zh: fields.name_zh,
      sort_order,
      active: true,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'note_preset_group_create_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { group: data as MenuNotePresetGroup };
}

export async function updateMenuNotePresetGroup(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
  patch: Partial<MenuNotePresetNameFields> & { active?: boolean },
): Promise<{ group: MenuNotePresetGroup } | MenuNotePresetMutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_note_preset_group_id', status: 400 };

  const update: Record<string, unknown> = {};
  if (typeof patch.name_en === 'string') update.name_en = patch.name_en.trim();
  if (typeof patch.name_pt === 'string') update.name_pt = patch.name_pt.trim();
  if (typeof patch.name_zh === 'string') update.name_zh = patch.name_zh.trim();
  if (typeof patch.active === 'boolean') update.active = patch.active;
  if (Object.keys(update).length === 0) {
    return { error: 'invalid_note_preset_group_patch', status: 400 };
  }
  if (update.name_en === '' || update.name_pt === '') {
    return { error: 'note_preset_en_pt_required', status: 400 };
  }

  const { data, error } = await admin
    .from('menu_note_preset_groups')
    .update(update)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    return { error: 'note_preset_group_update_failed', message: error.message, status: 500 };
  }
  if (!data) return { error: 'note_preset_group_not_found', status: 404 };
  await invalidateCustomerMenuCatalog(restaurantId);
  return { group: data as MenuNotePresetGroup };
}

export async function deleteMenuNotePresetGroup(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
): Promise<{ ok: true } | MenuNotePresetMutationError> {
  const id = parseTableIdParam(groupId);
  if (!id) return { error: 'invalid_note_preset_group_id', status: 400 };

  const { count, error: countError } = await admin
    .from('menu_note_presets')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('group_id', id);
  if (countError) {
    return { error: 'note_presets_query_failed', message: countError.message, status: 500 };
  }
  if ((count ?? 0) > 0) {
    return {
      error: 'note_preset_group_not_empty',
      status: 409,
      referenced_item_count: count ?? 0,
    };
  }

  const unbound = await unbindGroupFromMenuItems(admin, restaurantId, id);
  if ('error' in unbound) return unbound;

  const { error, count: deleted } = await admin
    .from('menu_note_preset_groups')
    .delete({ count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('id', id);
  if (error) {
    return { error: 'note_preset_group_delete_failed', message: error.message, status: 500 };
  }
  if (!deleted) return { error: 'note_preset_group_not_found', status: 404 };
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function reorderMenuNotePresetGroups(
  admin: SupabaseClient,
  restaurantId: string,
  orderedIdsRaw: unknown,
): Promise<{ ok: true } | MenuNotePresetMutationError> {
  const orderedIds = parseOrderedIds(orderedIdsRaw);
  if (!orderedIds) return { error: 'invalid_ordered_ids', status: 400 };

  const { data: rows, error } = await admin
    .from('menu_note_preset_groups')
    .select('id, sort_order')
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'note_preset_groups_query_failed', message: error.message, status: 500 };
  }
  const existing = (rows || []) as Array<{ id: string; sort_order: number }>;
  if (!orderedIdsMatchSiblingSet(existing, orderedIds)) {
    return { error: 'note_preset_group_reorder_mismatch', status: 400 };
  }
  const updates = permuteSortOrderAssignments(existing, orderedIds);
  if (!updates) {
    return { error: 'note_preset_group_reorder_mismatch', status: 400 };
  }
  for (const row of updates) {
    const { error: updError } = await admin
      .from('menu_note_preset_groups')
      .update({ sort_order: row.sort_order })
      .eq('restaurant_id', restaurantId)
      .eq('id', row.id);
    if (updError) {
      return { error: 'note_preset_group_reorder_failed', message: updError.message, status: 500 };
    }
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function createMenuNotePreset(
  admin: SupabaseClient,
  restaurantId: string,
  groupIdRaw: unknown,
  fields: MenuNotePresetNameFields,
): Promise<{ preset: MenuNotePreset } | MenuNotePresetMutationError> {
  const groupId = parseTableIdParam(groupIdRaw);
  if (!groupId) return { error: 'invalid_note_preset_group_id', status: 400 };

  const { data: group, error: groupError } = await admin
    .from('menu_note_preset_groups')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) {
    return { error: 'note_preset_groups_query_failed', message: groupError.message, status: 500 };
  }
  if (!group) return { error: 'note_preset_group_not_found', status: 404 };

  const sort_order = await nextPresetSortOrder(admin, restaurantId, groupId);
  const { data, error } = await admin
    .from('menu_note_presets')
    .insert({
      restaurant_id: restaurantId,
      group_id: groupId,
      name_en: fields.name_en,
      name_pt: fields.name_pt,
      name_zh: fields.name_zh,
      sort_order,
      active: true,
    })
    .select('*')
    .single();
  if (error || !data) {
    return { error: 'note_preset_create_failed', message: error?.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { preset: data as MenuNotePreset };
}

export async function updateMenuNotePreset(
  admin: SupabaseClient,
  restaurantId: string,
  presetId: string,
  patch: Partial<MenuNotePresetNameFields> & { active?: boolean; group_id?: string },
): Promise<{ preset: MenuNotePreset } | MenuNotePresetMutationError> {
  const id = parseTableIdParam(presetId);
  if (!id) return { error: 'invalid_note_preset_id', status: 400 };

  const update: Record<string, unknown> = {};
  if (typeof patch.name_en === 'string') update.name_en = patch.name_en.trim();
  if (typeof patch.name_pt === 'string') update.name_pt = patch.name_pt.trim();
  if (typeof patch.name_zh === 'string') update.name_zh = patch.name_zh.trim();
  if (typeof patch.active === 'boolean') update.active = patch.active;
  if (typeof patch.group_id === 'string') {
    const groupId = parseTableIdParam(patch.group_id);
    if (!groupId) return { error: 'invalid_note_preset_group_id', status: 400 };
    const { data: group, error: groupError } = await admin
      .from('menu_note_preset_groups')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('id', groupId)
      .maybeSingle();
    if (groupError) {
      return { error: 'note_preset_groups_query_failed', message: groupError.message, status: 500 };
    }
    if (!group) return { error: 'note_preset_group_not_found', status: 404 };
    update.group_id = groupId;
  }
  if (Object.keys(update).length === 0) {
    return { error: 'invalid_note_preset_patch', status: 400 };
  }
  if (update.name_en === '' || update.name_pt === '') {
    return { error: 'note_preset_en_pt_required', status: 400 };
  }

  const { data, error } = await admin
    .from('menu_note_presets')
    .update(update)
    .eq('restaurant_id', restaurantId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) {
    return { error: 'note_preset_update_failed', message: error.message, status: 500 };
  }
  if (!data) return { error: 'note_preset_not_found', status: 404 };
  await invalidateCustomerMenuCatalog(restaurantId);
  return { preset: data as MenuNotePreset };
}

async function unbindGroupFromMenuItems(
  admin: SupabaseClient,
  restaurantId: string,
  groupId: string,
): Promise<{ ok: true } | MenuNotePresetMutationError> {
  const { data, error } = await admin
    .from('menu_items')
    .select('id, note_preset_group_ids')
    .eq('restaurant_id', restaurantId)
    .contains('note_preset_group_ids', [groupId]);
  if (error) {
    return { error: 'menu_items_query_failed', message: error.message, status: 500 };
  }
  for (const row of data || []) {
    const keys = Array.isArray(row.note_preset_group_ids)
      ? (row.note_preset_group_ids as string[]).filter((k) => k !== groupId)
      : [];
    const { error: updError } = await admin
      .from('menu_items')
      .update({ note_preset_group_ids: keys })
      .eq('restaurant_id', restaurantId)
      .eq('id', row.id);
    if (updError) {
      return { error: 'note_preset_unbind_failed', message: updError.message, status: 500 };
    }
  }
  return { ok: true };
}

export async function deleteMenuNotePreset(
  admin: SupabaseClient,
  restaurantId: string,
  presetId: string,
): Promise<{ ok: true; referenced_item_count: number } | MenuNotePresetMutationError> {
  const id = parseTableIdParam(presetId);
  if (!id) return { error: 'invalid_note_preset_id', status: 400 };

  const { error, count: deleted } = await admin
    .from('menu_note_presets')
    .delete({ count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .eq('id', id);
  if (error) {
    return { error: 'note_preset_delete_failed', message: error.message, status: 500 };
  }
  if (!deleted) return { error: 'note_preset_not_found', status: 404 };
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true, referenced_item_count: 0 };
}

export async function reorderMenuNotePresets(
  admin: SupabaseClient,
  restaurantId: string,
  groupIdRaw: unknown,
  orderedIdsRaw: unknown,
): Promise<{ ok: true } | MenuNotePresetMutationError> {
  const groupId = parseTableIdParam(groupIdRaw);
  if (!groupId) return { error: 'invalid_note_preset_group_id', status: 400 };
  const orderedIds = parseOrderedIds(orderedIdsRaw);
  if (!orderedIds) return { error: 'invalid_ordered_ids', status: 400 };

  const { data: rows, error } = await admin
    .from('menu_note_presets')
    .select('id, sort_order')
    .eq('restaurant_id', restaurantId)
    .eq('group_id', groupId);
  if (error) {
    return { error: 'note_presets_query_failed', message: error.message, status: 500 };
  }
  const existing = (rows || []) as Array<{ id: string; sort_order: number }>;
  if (!orderedIdsMatchSiblingSet(existing, orderedIds)) {
    return { error: 'note_preset_reorder_mismatch', status: 400 };
  }
  const updates = permuteSortOrderAssignments(existing, orderedIds);
  if (!updates) {
    return { error: 'note_preset_reorder_mismatch', status: 400 };
  }
  for (const row of updates) {
    const { error: updError } = await admin
      .from('menu_note_presets')
      .update({ sort_order: row.sort_order })
      .eq('restaurant_id', restaurantId)
      .eq('id', row.id);
    if (updError) {
      return { error: 'note_preset_reorder_failed', message: updError.message, status: 500 };
    }
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export function parseNotePresetNameBody(
  raw: Record<string, unknown>,
): MenuNotePresetNameFields | MenuNotePresetMutationError {
  return parseMenuNotePresetNameFields(raw);
}
