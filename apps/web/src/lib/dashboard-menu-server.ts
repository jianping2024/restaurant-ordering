import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeAllergenCodes } from '@/lib/allergens';
import { normalizeFlavorCodes } from '@/lib/flavors';
import { normalizeMenuItemLimitFields } from '@/lib/sushi-buffet-limits';
import {
  collectCategorySubtreeIds,
  MAX_MENU_CATEGORY_DEPTH,
  sortCategoryIdsLeavesFirst,
} from '@/lib/menu-admin';
import { menuItemHasDuplicateCode, siblingCategoryHasDuplicateCode } from '@/lib/menu-code-uniqueness';
import {
  MENU_IMAGE_MAX_BYTES,
  MENU_STORAGE_CACHE_CONTROL,
  menuImageObjectPath,
  pathFromMenuImagePublicUrl,
  toMenuImagePublicRef,
} from '@/lib/menu-image';
import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import {
  isAllowedMenuVatRate,
  parseMenuVatRate,
} from '@/lib/menu-vat-rate';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import {
  compareMenuItemsForDisplay,
  menuItemSiblingsInScope,
} from '@/lib/menu-item-order';
import { menuCategorySiblingsInScope } from '@/lib/menu-category-order';
import { persistZeroBasedSortOrders } from '@/lib/sort-order-persist';
import { nextSortOrder, orderedIdsMatchSiblingSet } from '@/lib/sort-order';
import { invalidateCustomerMenuCatalog } from '@/lib/customer-menu-catalog';
import { normalizeMenuItemNotePresetGroupIds } from '@/lib/menu-note-presets';
import { listRestaurantNotePresetGroupIds } from '@/lib/menu-note-presets-query';
import {
  MENU_RECOMMENDED_ITEMS_MAX,
  parseRecommendedMenuItemIds,
} from '@/lib/menu-recommended';
import {
  DISH_VIDEO_MAX_BYTES,
  DISH_VIDEO_MIME,
  dishVideoObjectPath,
  isDishVideoEffect,
} from '@/lib/menu-dish-video';
import type { MenuCategory, MenuItem, PrintStation } from '@/types';

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type MenuMutationError = { error: string; message?: string; status: number };

export type CategoryBodyFields = {
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  item_code: string;
  print_station_id: string | null;
};

export type PrintStationBodyFields = {
  name_pt: string;
  name_en: string | null;
  name_zh: string | null;
  kitchen_enabled?: boolean;
};

function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

/** Insert/update failure of a menu item row → stable API error. */
function menuItemWriteError(
  error: { code?: string; message: string } | null,
  fallback: 'insert_failed' | 'update_failed',
): MenuMutationError {
  if (uniqueViolation(error)) {
    return { error: 'item_code_duplicate', message: error?.message, status: 409 };
  }
  // Composite FK (restaurant_id, time_slot_id): slot missing or another restaurant's.
  if (error?.code === '23503' && error.message.includes('menu_items_time_slot_fkey')) {
    return { error: 'time_slot_not_found', message: error.message, status: 400 };
  }
  return { error: fallback, message: error?.message, status: 500 };
}

function categoryDepth(categoryId: string, categories: MenuCategory[]): number {
  const row = categories.find((c) => c.id === categoryId);
  if (!row?.parent_id) return 1;
  return 1 + categoryDepth(row.parent_id, categories);
}

async function loadActiveCategories(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<MenuCategory[] | MenuMutationError> {
  const { data, error } = await admin
    .from('menu_categories')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .order('sort_order');
  if (error) {
    return { error: 'menu_categories_query_failed', message: error.message, status: 500 };
  }
  return (data || []) as MenuCategory[];
}

async function loadMenuItems(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<MenuItem[] | MenuMutationError> {
  const { data, error } = await admin
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'menu_items_query_failed', message: error.message, status: 500 };
  }
  return (data || []) as MenuItem[];
}

async function getCategoryById(
  admin: SupabaseClient,
  restaurantId: string,
  categoryId: string,
): Promise<MenuCategory | MenuMutationError> {
  const { data, error } = await admin
    .from('menu_categories')
    .select('*')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurantId)
    .eq('active', true)
    .maybeSingle();
  if (error) {
    return { error: 'menu_category_query_failed', message: error.message, status: 500 };
  }
  if (!data) {
    return { error: 'category_not_found', status: 404 };
  }
  return data as MenuCategory;
}

export async function createMenuCategory(
  admin: SupabaseClient,
  restaurantId: string,
  input: {
    parent_id?: string | null;
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    item_code: string;
    print_station_id?: string | null;
  },
): Promise<{ category: MenuCategory } | MenuMutationError> {
  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }
  const normalizedCode = normalizeMenuItemCode(input.item_code);
  if (!normalizedCode) {
    return { error: 'category_code_required', status: 400 };
  }

  const parentId = input.parent_id ? parseTableIdParam(input.parent_id) : null;
  if (input.parent_id && !parentId) {
    return { error: 'invalid_parent_id', status: 400 };
  }

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;

  if (parentId) {
    const parent = categories.find((c) => c.id === parentId);
    if (!parent) {
      return { error: 'parent_not_found', status: 404 };
    }
    if (categoryDepth(parentId, categories) >= MAX_MENU_CATEGORY_DEPTH) {
      return { error: 'category_depth_exceeded', status: 400 };
    }
  }

  if (siblingCategoryHasDuplicateCode(categories, parentId, normalizedCode)) {
    return { error: 'category_code_duplicate', status: 409 };
  }

  const siblings = menuCategorySiblingsInScope(categories, parentId);
  const { data, error } = await admin
    .from('menu_categories')
    .insert({
      restaurant_id: restaurantId,
      parent_id: parentId,
      name_pt: namePt,
      name_en: input.name_en?.trim() || null,
      name_zh: input.name_zh?.trim() || null,
      item_code: normalizedCode,
      print_station_id: input.print_station_id || null,
      sort_order: nextSortOrder(siblings),
      active: true,
    })
    .select()
    .single();

  if (error) {
    return {
      error: uniqueViolation(error) ? 'category_code_duplicate' : 'insert_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { category: data as MenuCategory };
}

export async function updateMenuCategory(
  admin: SupabaseClient,
  restaurantId: string,
  categoryId: string,
  input: {
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    item_code: string;
    print_station_id?: string | null;
  },
): Promise<{ category: MenuCategory } | MenuMutationError> {
  const id = parseTableIdParam(categoryId);
  if (!id) {
    return { error: 'invalid_category_id', status: 400 };
  }

  const existing = await getCategoryById(admin, restaurantId, id);
  if ('error' in existing) return existing;

  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }
  const normalizedCode = normalizeMenuItemCode(input.item_code);
  if (!normalizedCode) {
    return { error: 'category_code_required', status: 400 };
  }

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;

  const parentId = existing.parent_id ?? null;
  if (siblingCategoryHasDuplicateCode(categories, parentId, normalizedCode, id)) {
    return { error: 'category_code_duplicate', status: 409 };
  }

  const { data, error } = await admin
    .from('menu_categories')
    .update({
      name_pt: namePt,
      name_en: input.name_en?.trim() || null,
      name_zh: input.name_zh?.trim() || null,
      item_code: normalizedCode,
      print_station_id: input.print_station_id || null,
    })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) {
    return {
      error: uniqueViolation(error) ? 'category_code_duplicate' : 'update_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { category: data as MenuCategory };
}

export async function reorderMenuCategories(
  admin: SupabaseClient,
  restaurantId: string,
  parentId: string | null,
  orderedIdsRaw: unknown,
): Promise<{ ok: true } | MenuMutationError> {
  if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }
  if (orderedIdsRaw.some((id) => typeof id !== 'string')) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const orderedIds: string[] = [];
  for (const raw of orderedIdsRaw as string[]) {
    const id = parseTableIdParam(raw);
    if (!id) {
      return { error: 'invalid_ordered_ids', status: 400 };
    }
    orderedIds.push(id);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  if (parentId) {
    const parent = await getCategoryById(admin, restaurantId, parentId);
    if ('error' in parent) return parent;
  }

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;

  const siblingRows = menuCategorySiblingsInScope(categories, parentId);
  if (!orderedIdsMatchSiblingSet(siblingRows, orderedIds)) {
    return { error: 'reorder_scope_mismatch', status: 400 };
  }

  const scopeMax =
    siblingRows.length === 0 ? -1 : Math.max(...siblingRows.map((row) => row.sort_order));
  const persisted = await persistZeroBasedSortOrders(
    admin,
    'menu_categories',
    restaurantId,
    orderedIds,
    scopeMax,
  );
  if ('error' in persisted) {
    return { error: persisted.error, message: persisted.message, status: 500 };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function deleteMenuCategory(
  admin: SupabaseClient,
  restaurantId: string,
  input: {
    category_id: string;
    mode: 'empty' | 'migrate' | 'delete_all';
    migrate_target_id?: string | null;
  },
): Promise<{ ok: true } | MenuMutationError> {
  const categoryId = parseTableIdParam(input.category_id);
  if (!categoryId) {
    return { error: 'invalid_category_id', status: 400 };
  }

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;

  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return { error: 'category_not_found', status: 404 };
  }

  const subtreeIds = collectCategorySubtreeIds(categoryId, categories);
  const subtreeSet = new Set(subtreeIds);
  const items = await loadMenuItems(admin, restaurantId);
  if ('error' in items) return items;

  const linkedInSubtree = items.filter(
    (item) => item.category_id && subtreeSet.has(item.category_id),
  );

  if (input.mode === 'migrate') {
    const migrateTargetId = parseTableIdParam(input.migrate_target_id);
    if (!migrateTargetId) {
      return { error: 'invalid_migrate_target', status: 400 };
    }
    if (subtreeSet.has(migrateTargetId)) {
      return { error: 'migrate_target_in_subtree', status: 400 };
    }
    const target = categories.find((c) => c.id === migrateTargetId);
    if (!target) {
      return { error: 'migrate_target_not_found', status: 404 };
    }
    const targetSiblings = menuItemSiblingsInScope(items, target.id);
    let nextOrder = nextSortOrder(targetSiblings);
    const migrating = [...linkedInSubtree].sort(compareMenuItemsForDisplay);
    for (const item of migrating) {
      const { error: moveError } = await admin
        .from('menu_items')
        .update({
          category_id: target.id,
          category: target.name_pt,
          category_en: target.name_en || target.name_pt,
          category_zh: target.name_zh || target.name_pt,
          sort_order: nextOrder++,
        })
        .eq('id', item.id)
        .eq('restaurant_id', restaurantId);
      if (moveError) {
        return { error: 'migrate_failed', message: moveError.message, status: 500 };
      }
    }
  } else if (linkedInSubtree.length > 0) {
    if (input.mode !== 'delete_all') {
      return { error: 'category_has_linked_items', status: 409 };
    }
    for (const item of linkedInSubtree) {
      await removeMenuItemStorageObjects(admin, item);
    }
    const { error: dishDeleteError } = await admin
      .from('menu_items')
      .delete()
      .eq('restaurant_id', restaurantId)
      .in('category_id', subtreeIds);
    if (dishDeleteError) {
      return { error: 'delete_items_failed', message: dishDeleteError.message, status: 500 };
    }
  }

  for (const cid of sortCategoryIdsLeavesFirst(subtreeIds, categories)) {
    const { error } = await admin
      .from('menu_categories')
      .delete()
      .eq('id', cid)
      .eq('restaurant_id', restaurantId);
    if (error) {
      return { error: 'delete_category_failed', message: error.message, status: 500 };
    }
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

type MenuItemInput = {
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  description_pt?: string | null;
  description_en?: string | null;
  description_zh?: string | null;
  price: number;
  vat_rate: number;
  category_id: string;
  item_code: string;
  /** Empty = inherit category default. */
  print_station_ids: string[];
  emoji: string;
  available: boolean;
  note_preset_group_ids: string[];
  allergen_codes: string[];
  flavor_codes: string[];
  is_vegetarian: boolean;
  station_print_pt: boolean;
  station_print_en: boolean;
  station_print_zh: boolean;
  per_person_qty_limit: number | null;
  over_limit_unit_price: number | null;
  /** Null = all day. Same-restaurant check is the composite FK. */
  time_slot_id: string | null;
  takeaway_role: 'none' | 'sellable' | 'takeaway_only' | 'packaging';
  takeaway_price: number | null;
};

function validateMenuItemInput(
  input: MenuItemInput,
  items: MenuItem[],
  categories: MenuCategory[],
  editingId?: string,
): MenuCategory | MenuMutationError {
  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }
  if (!Number.isFinite(input.price)) {
    return { error: 'invalid_price', status: 400 };
  }
  if (
    (input.takeaway_role === 'sellable' || input.takeaway_role === 'takeaway_only') &&
    (input.takeaway_price == null ||
      !Number.isFinite(input.takeaway_price) ||
      input.takeaway_price <= 0)
  ) {
    return { error: 'invalid_takeaway_price', status: 400 };
  }
  if (!isAllowedMenuVatRate(input.vat_rate)) {
    return { error: 'invalid_vat_rate', status: 400 };
  }

  const categoryId = parseTableIdParam(input.category_id);
  if (!categoryId) {
    return { error: 'invalid_category_id', status: 400 };
  }
  const category = categories.find((c) => c.id === categoryId);
  if (!category) {
    return { error: 'category_not_found', status: 404 };
  }

  const normalizedCode = normalizeMenuItemCode(input.item_code);
  if (!normalizedCode) {
    return { error: 'item_code_required', status: 400 };
  }
  if (menuItemHasDuplicateCode(items, normalizedCode, editingId)) {
    return { error: 'item_code_duplicate', status: 409 };
  }

  return category;
}

function buildMenuItemPayload(
  restaurantId: string,
  category: MenuCategory,
  input: MenuItemInput,
  normalizedCode: string,
) {
  return {
    restaurant_id: restaurantId,
    name_pt: input.name_pt.trim(),
    name_en: input.name_en?.trim() || null,
    name_zh: input.name_zh?.trim() || null,
    description_pt: input.description_pt?.trim() || null,
    description_en: input.description_en?.trim() || null,
    description_zh: input.description_zh?.trim() || null,
    price: input.price,
    vat_rate: input.vat_rate,
    category_id: category.id,
    category: category.name_pt,
    category_en: category.name_en || category.name_pt,
    category_zh: category.name_zh || category.name_pt,
    emoji: input.emoji,
    available: input.available,
    note_preset_group_ids: input.note_preset_group_ids,
    allergen_codes: input.allergen_codes,
    flavor_codes: input.flavor_codes,
    is_vegetarian: input.is_vegetarian,
    // A name that is empty can never be ticked (station-slip-multilang-names §7).
    station_print_pt: input.station_print_pt,
    station_print_en: input.station_print_en && !!input.name_en?.trim(),
    station_print_zh: input.station_print_zh && !!input.name_zh?.trim(),
    print_station_ids: input.print_station_ids,
    item_code: normalizedCode,
    per_person_qty_limit: input.per_person_qty_limit,
    over_limit_unit_price: input.over_limit_unit_price,
    time_slot_id: input.time_slot_id,
    takeaway_role: input.takeaway_role,
    takeaway_price:
      input.takeaway_role === 'sellable' || input.takeaway_role === 'takeaway_only'
        ? input.takeaway_price
        : null,
  };
}

async function withValidatedNotePresetGroupIds(
  admin: SupabaseClient,
  restaurantId: string,
  input: MenuItemInput,
): Promise<MenuItemInput | MenuMutationError> {
  const allowed = await listRestaurantNotePresetGroupIds(admin, restaurantId);
  if (!(allowed instanceof Set)) {
    return { error: allowed.error, message: allowed.message, status: allowed.status };
  }
  const keys = normalizeMenuItemNotePresetGroupIds(input.note_preset_group_ids, allowed);
  if (!Array.isArray(keys)) {
    return { error: keys.error, status: keys.status };
  }
  return { ...input, note_preset_group_ids: keys };
}

async function assertMenuItemPrintStationIds(
  admin: SupabaseClient,
  restaurantId: string,
  ids: string[],
): Promise<MenuMutationError | null> {
  if (ids.length === 0) return null;
  const { data, error } = await admin
    .from('print_stations')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .in('id', ids);
  if (error) {
    return { error: 'print_stations_query_failed', message: error.message, status: 500 };
  }
  if ((data || []).length !== ids.length) {
    return { error: 'invalid_print_station_ids', status: 400 };
  }
  return null;
}

export async function createMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  input: MenuItemInput,
): Promise<{ item: MenuItem } | MenuMutationError> {
  const validated = await withValidatedNotePresetGroupIds(admin, restaurantId, input);
  if ('error' in validated) return validated;

  const stationErr = await assertMenuItemPrintStationIds(
    admin,
    restaurantId,
    validated.print_station_ids,
  );
  if (stationErr) return stationErr;

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;
  const items = await loadMenuItems(admin, restaurantId);
  if ('error' in items) return items;

  const categoryOrError = validateMenuItemInput(validated, items, categories);
  if ('error' in categoryOrError) return categoryOrError;
  const category = categoryOrError;

  const normalizedCode = normalizeMenuItemCode(validated.item_code)!;
  const categoryItems = menuItemSiblingsInScope(items, category.id);
  const { data, error } = await admin
    .from('menu_items')
    .insert({
      ...buildMenuItemPayload(restaurantId, category, validated, normalizedCode),
      sort_order: nextSortOrder(categoryItems),
    })
    .select()
    .single();

  if (error) return menuItemWriteError(error, 'insert_failed');

  await invalidateCustomerMenuCatalog(restaurantId);
  return { item: data as MenuItem };
}

export async function reorderMenuItems(
  admin: SupabaseClient,
  restaurantId: string,
  orderedIdsRaw: unknown,
): Promise<{ ok: true } | MenuMutationError> {
  if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }
  if (orderedIdsRaw.some((id) => typeof id !== 'string')) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const orderedIds: string[] = [];
  for (const raw of orderedIdsRaw as string[]) {
    const id = parseTableIdParam(raw);
    if (!id) {
      return { error: 'invalid_ordered_ids', status: 400 };
    }
    orderedIds.push(id);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const { data: firstRow, error: firstError } = await admin
    .from('menu_items')
    .select('id, category_id')
    .eq('id', orderedIds[0]!)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (firstError) {
    return { error: 'menu_items_query_failed', message: firstError.message, status: 500 };
  }
  if (!firstRow) {
    return { error: 'item_not_found', status: 404 };
  }

  let siblingsQuery = admin
    .from('menu_items')
    .select('id, sort_order, category_id')
    .eq('restaurant_id', restaurantId);
  siblingsQuery = firstRow.category_id
    ? siblingsQuery.eq('category_id', firstRow.category_id)
    : siblingsQuery.is('category_id', null);

  const { data: siblings, error: siblingsError } = await siblingsQuery;
  if (siblingsError) {
    return { error: 'menu_items_query_failed', message: siblingsError.message, status: 500 };
  }

  const siblingRows = siblings ?? [];
  if (!orderedIdsMatchSiblingSet(siblingRows, orderedIds)) {
    return { error: 'reorder_scope_mismatch', status: 400 };
  }

  const scopeMax =
    siblingRows.length === 0 ? -1 : Math.max(...siblingRows.map((row) => row.sort_order));
  const persisted = await persistZeroBasedSortOrders(
    admin,
    'menu_items',
    restaurantId,
    orderedIds,
    scopeMax,
  );
  if ('error' in persisted) {
    return { error: persisted.error, message: persisted.message, status: 500 };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function updateMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  itemId: string,
  input: MenuItemInput,
): Promise<{ item: MenuItem } | MenuMutationError> {
  const id = parseTableIdParam(itemId);
  if (!id) {
    return { error: 'invalid_item_id', status: 400 };
  }

  const validated = await withValidatedNotePresetGroupIds(admin, restaurantId, input);
  if ('error' in validated) return validated;

  const stationErr = await assertMenuItemPrintStationIds(
    admin,
    restaurantId,
    validated.print_station_ids,
  );
  if (stationErr) return stationErr;

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;
  const items = await loadMenuItems(admin, restaurantId);
  if ('error' in items) return items;

  const existing = items.find((item) => item.id === id && item.restaurant_id === restaurantId);
  if (!existing) {
    return { error: 'item_not_found', status: 404 };
  }

  const categoryOrError = validateMenuItemInput(validated, items, categories, id);
  if ('error' in categoryOrError) return categoryOrError;
  const category = categoryOrError;

  const normalizedCode = normalizeMenuItemCode(validated.item_code)!;
  const categoryChanged = existing.category_id !== category.id;
  const updatePayload = {
    ...buildMenuItemPayload(restaurantId, category, validated, normalizedCode),
    ...(categoryChanged
      ? { sort_order: nextSortOrder(menuItemSiblingsInScope(items, category.id, id)) }
      : {}),
  };
  const { data, error } = await admin
    .from('menu_items')
    .update(updatePayload)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) return menuItemWriteError(error, 'update_failed');

  await invalidateCustomerMenuCatalog(restaurantId);
  return { item: data as MenuItem };
}

export async function deleteMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  itemId: string,
): Promise<{ ok: true } | MenuMutationError> {
  const id = parseTableIdParam(itemId);
  if (!id) {
    return { error: 'invalid_item_id', status: 400 };
  }

  const { data: item, error: queryError } = await admin
    .from('menu_items')
    .select('id, image_url, video_url, rail_video_url')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (queryError) {
    return { error: 'item_query_failed', message: queryError.message, status: 500 };
  }
  if (!item) {
    return { error: 'item_not_found', status: 404 };
  }

  await removeMenuItemStorageObjects(admin, item);
  const { error } = await admin.from('menu_items').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'delete_failed', message: error.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

export async function batchSetMenuItemsAvailable(
  admin: SupabaseClient,
  restaurantId: string,
  itemIds: string[],
  available: boolean,
): Promise<{ ok: true } | MenuMutationError> {
  const ids = itemIds.map((raw) => parseTableIdParam(raw)).filter((id): id is string => !!id);
  if (ids.length === 0) {
    return { error: 'invalid_item_ids', status: 400 };
  }

  const { error } = await admin
    .from('menu_items')
    .update({ available })
    .eq('restaurant_id', restaurantId)
    .in('id', ids);
  if (error) {
    return { error: 'update_failed', message: error.message, status: 500 };
  }
  await invalidateCustomerMenuCatalog(restaurantId);
  return { ok: true };
}

/** Remove one public `menu-images` object (photo or dish video) by its stored URL. */
async function removeMenuStorageObject(
  admin: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!publicUrl) return { ok: true };
  const path = pathFromMenuImagePublicUrl(publicUrl);
  if (!path) return { ok: true };
  const { error } = await admin.storage.from('menu-images').remove([path]);
  if (error) {
    const msg = error.message.toLowerCase();
    // Already gone (legacy URL / other env) — nothing left to delete.
    if (msg.includes('not found') || msg.includes('does not exist') || msg.includes('404')) {
      return { ok: true };
    }
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

type MenuItemMediaUrls = Pick<MenuItem, 'image_url' | 'video_url' | 'rail_video_url'>;

/** Sole cleanup when a dish row goes away: photo + both dish videos. */
async function removeMenuItemStorageObjects(admin: SupabaseClient, item: MenuItemMediaUrls) {
  await removeMenuStorageObject(admin, item.image_url);
  await removeMenuStorageObject(admin, item.video_url);
  await removeMenuStorageObject(admin, item.rail_video_url);
}

export type MenuItemMediaInput = {
  /** New compressed photo, or null to keep / strip. */
  file: File | null;
  stripImage: boolean;
  /** New dish videos encoded in the staff browser from the final photo. */
  video: { detail: File; rail: File; effect: string } | null;
  /** Drop the current videos while keeping the photo (effect "none"). */
  stripVideo: boolean;
  /** Pro `menu_dish_video` + `dashboard.menu.video.manage` (resolveDishVideoAccess). */
  canManageVideo: boolean;
};

function trimmedUrl(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Sole dish photo + motion-video write. Any photo change clears the videos unless new
 * videos come in the same request (a video always matches the photo it was made from).
 */
export async function setMenuItemImage(
  admin: SupabaseClient,
  restaurantId: string,
  itemId: string,
  input: MenuItemMediaInput,
): Promise<{ item: MenuItem } | MenuMutationError> {
  const id = parseTableIdParam(itemId);
  if (!id) {
    return { error: 'invalid_item_id', status: 400 };
  }
  const { file, stripImage, video, stripVideo, canManageVideo } = input;
  if ((video || stripVideo) && !canManageVideo) {
    return { error: 'dish_video_forbidden', status: 403 };
  }
  if (video && (stripImage || stripVideo)) {
    return { error: 'invalid_media_request', status: 400 };
  }
  if (file && (!ALLOWED_IMAGE_MIME.has(file.type) || file.size > MENU_IMAGE_MAX_BYTES)) {
    return { error: 'invalid_image', status: 400 };
  }
  if (
    video &&
    (!isDishVideoEffect(video.effect) ||
      [video.detail, video.rail].some((f) => f.type !== DISH_VIDEO_MIME || f.size > DISH_VIDEO_MAX_BYTES))
  ) {
    return { error: 'invalid_video', status: 400 };
  }

  const { data: existing, error: queryError } = await admin
    .from('menu_items')
    .select('*')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (queryError) {
    return { error: 'item_query_failed', message: queryError.message, status: 500 };
  }
  if (!existing) {
    return { error: 'item_not_found', status: 404 };
  }

  const previous = {
    image_url: trimmedUrl(existing.image_url),
    video_url: trimmedUrl(existing.video_url),
    rail_video_url: trimmedUrl(existing.rail_video_url),
    video_effect: trimmedUrl(existing.video_effect),
  };
  const imageChanges = Boolean(file) || (stripImage && previous.image_url != null);
  const finalHasImage = file ? true : stripImage ? false : previous.image_url != null;
  if (video && !finalHasImage) {
    return { error: 'image_required_for_video', status: 400 };
  }
  const videoClears = !video && previous.video_url != null && (imageChanges || stripVideo);
  if (!imageChanges && !video && !videoClears) {
    return { item: existing as MenuItem };
  }

  const uploadedPaths: string[] = [];
  const rollbackUploads = async () => {
    if (uploadedPaths.length > 0) await admin.storage.from('menu-images').remove(uploadedPaths);
  };
  const upload = async (path: string, body: File) => {
    const { error } = await admin.storage.from('menu-images').upload(path, Buffer.from(await body.arrayBuffer()), {
      upsert: false,
      contentType: body.type,
      cacheControl: MENU_STORAGE_CACHE_CONTROL,
    });
    if (error) return error.message;
    uploadedPaths.push(path);
    return null;
  };

  const patch: Record<string, string | null> = {};
  if (file) {
    const path = menuImageObjectPath(restaurantId, id, file.type, randomUUID());
    const failed = await upload(path, file);
    if (failed) return { error: 'upload_failed', message: failed, status: 500 };
    patch.image_url = toMenuImagePublicRef(path);
  } else if (imageChanges) {
    patch.image_url = null;
  }
  if (video) {
    const key = randomUUID();
    for (const variant of ['detail', 'rail'] as const) {
      const path = dishVideoObjectPath(restaurantId, id, variant, key);
      const failed = await upload(path, video[variant]);
      if (failed) {
        await rollbackUploads();
        return { error: 'upload_failed', message: failed, status: 500 };
      }
      patch[variant === 'detail' ? 'video_url' : 'rail_video_url'] = toMenuImagePublicRef(path);
    }
    patch.video_effect = video.effect;
  } else if (videoClears) {
    patch.video_url = null;
    patch.rail_video_url = null;
    patch.video_effect = null;
  }

  const { data, error } = await admin
    .from('menu_items')
    .update(patch)
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();
  if (error) {
    await rollbackUploads();
    return { error: 'update_failed', message: error.message, status: 500 };
  }

  const obsolete = (['image_url', 'video_url', 'rail_video_url'] as const)
    .filter((key) => key in patch && previous[key] && previous[key] !== patch[key])
    .map((key) => previous[key]);
  for (const url of obsolete) {
    const removed = await removeMenuStorageObject(admin, url);
    if (!removed.ok) {
      await admin.from('menu_items').update(previous).eq('id', id).eq('restaurant_id', restaurantId);
      await rollbackUploads();
      return { error: 'cleanup_failed', message: removed.message, status: 500 };
    }
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { item: data as MenuItem };
}

export async function createPrintStation(
  admin: SupabaseClient,
  restaurantId: string,
  input: {
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    kitchen_enabled?: boolean;
  },
): Promise<{ station: PrintStation } | MenuMutationError> {
  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }

  const { data: rows, error: listError } = await admin
    .from('print_stations')
    .select('sort_order')
    .eq('restaurant_id', restaurantId);
  if (listError) {
    return { error: 'print_stations_query_failed', message: listError.message, status: 500 };
  }

  const { data, error } = await admin
    .from('print_stations')
    .insert({
      restaurant_id: restaurantId,
      name_pt: namePt,
      name_en: input.name_en?.trim() || null,
      name_zh: input.name_zh?.trim() || null,
      sort_order: nextSortOrder(rows ?? []),
      ...(typeof input.kitchen_enabled === 'boolean'
        ? { kitchen_enabled: input.kitchen_enabled }
        : {}),
    })
    .select()
    .single();
  if (error) {
    return { error: 'insert_failed', message: error.message, status: 500 };
  }
  return { station: data as PrintStation };
}

export async function updatePrintStation(
  admin: SupabaseClient,
  restaurantId: string,
  stationId: string,
  input: {
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    kitchen_enabled?: boolean;
  },
): Promise<{ station: PrintStation } | MenuMutationError> {
  const id = parseTableIdParam(stationId);
  if (!id) {
    return { error: 'invalid_station_id', status: 400 };
  }
  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }

  const { data, error } = await admin
    .from('print_stations')
    .update({
      name_pt: namePt,
      name_en: input.name_en?.trim() || null,
      name_zh: input.name_zh?.trim() || null,
      ...(typeof input.kitchen_enabled === 'boolean'
        ? { kitchen_enabled: input.kitchen_enabled }
        : {}),
    })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();
  if (error) {
    return { error: 'update_failed', message: error.message, status: 500 };
  }
  if (!data) {
    return { error: 'station_not_found', status: 404 };
  }
  return { station: data as PrintStation };
}

export async function reorderPrintStations(
  admin: SupabaseClient,
  restaurantId: string,
  orderedIdsRaw: unknown,
): Promise<{ ok: true } | MenuMutationError> {
  if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }
  if (orderedIdsRaw.some((id) => typeof id !== 'string')) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const orderedIds: string[] = [];
  for (const raw of orderedIdsRaw as string[]) {
    const id = parseTableIdParam(raw);
    if (!id) {
      return { error: 'invalid_ordered_ids', status: 400 };
    }
    orderedIds.push(id);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const { data: rows, error: listError } = await admin
    .from('print_stations')
    .select('id, sort_order')
    .eq('restaurant_id', restaurantId);
  if (listError) {
    return { error: 'print_stations_query_failed', message: listError.message, status: 500 };
  }

  const siblingRows = rows ?? [];
  if (!orderedIdsMatchSiblingSet(siblingRows, orderedIds)) {
    return { error: 'reorder_scope_mismatch', status: 400 };
  }

  const scopeMax =
    siblingRows.length === 0 ? -1 : Math.max(...siblingRows.map((row) => row.sort_order));
  const persisted = await persistZeroBasedSortOrders(
    admin,
    'print_stations',
    restaurantId,
    orderedIds,
    scopeMax,
  );
  if ('error' in persisted) {
    return { error: persisted.error, message: persisted.message, status: 500 };
  }

  return { ok: true };
}

export async function deletePrintStation(
  admin: SupabaseClient,
  restaurantId: string,
  stationId: string,
): Promise<{ ok: true } | MenuMutationError> {
  const id = parseTableIdParam(stationId);
  if (!id) {
    return { error: 'invalid_station_id', status: 400 };
  }

  const { error } = await admin
    .from('print_stations')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'delete_failed', message: error.message, status: 500 };
  }
  return { ok: true };
}

export function parseCategoryBody(
  raw: Record<string, unknown>,
): CategoryBodyFields | MenuMutationError {
  if (typeof raw.name_pt !== 'string' || typeof raw.item_code !== 'string') {
    return { error: 'invalid_category_body', status: 400 };
  }
  return {
    name_pt: raw.name_pt,
    name_en: typeof raw.name_en === 'string' ? raw.name_en : null,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : null,
    item_code: raw.item_code,
    print_station_id: typeof raw.print_station_id === 'string' ? raw.print_station_id : null,
  };
}

export function parseCategoryParentId(
  raw: Record<string, unknown>,
): string | null | MenuMutationError {
  if (raw.parent_id === null || raw.parent_id === undefined) return null;
  if (typeof raw.parent_id === 'string') return raw.parent_id;
  return { error: 'invalid_parent_id', status: 400 };
}

export function parsePrintStationBody(
  raw: Record<string, unknown>,
): PrintStationBodyFields | MenuMutationError {
  if (typeof raw.name_pt !== 'string') {
    return { error: 'invalid_station_body', status: 400 };
  }
  if (raw.kitchen_enabled !== undefined && typeof raw.kitchen_enabled !== 'boolean') {
    return { error: 'invalid_kitchen_enabled', status: 400 };
  }
  return {
    name_pt: raw.name_pt,
    name_en: typeof raw.name_en === 'string' ? raw.name_en : null,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : null,
    ...(typeof raw.kitchen_enabled === 'boolean'
      ? { kitchen_enabled: raw.kitchen_enabled }
      : {}),
  };
}

export function parseMenuItemBody(raw: Record<string, unknown>): MenuItemInput | MenuMutationError {
  const price = typeof raw.price === 'number' ? raw.price : Number(raw.price);
  const vatRate = parseMenuVatRate(typeof raw.vat_rate === 'string' ? raw.vat_rate : String(raw.vat_rate ?? ''));
  if (vatRate === null) {
    return { error: 'invalid_vat_rate', status: 400 };
  }

  if (typeof raw.name_pt !== 'string' || typeof raw.category_id !== 'string' || typeof raw.item_code !== 'string') {
    return { error: 'invalid_item_body', status: 400 };
  }
  if (typeof raw.emoji !== 'string') {
    return { error: 'invalid_item_body', status: 400 };
  }
  if (
    !Array.isArray(raw.note_preset_group_ids) ||
    raw.note_preset_group_ids.some((key) => typeof key !== 'string')
  ) {
    return { error: 'invalid_item_body', status: 400 };
  }
  const allergenCodes = normalizeAllergenCodes(raw.allergen_codes);
  if (allergenCodes === null) {
    return { error: 'invalid_allergen_codes', status: 400 };
  }
  const flavorCodes = normalizeFlavorCodes(raw.flavor_codes);
  if (flavorCodes === null) {
    return { error: 'invalid_flavor_codes', status: 400 };
  }

  let timeSlotId: string | null = null;
  if (raw.time_slot_id != null && raw.time_slot_id !== '') {
    timeSlotId = typeof raw.time_slot_id === 'string' ? parseTableIdParam(raw.time_slot_id) : null;
    if (!timeSlotId) return { error: 'invalid_time_slot_id', status: 400 };
  }

  const limits = normalizeMenuItemLimitFields({
    per_person_qty_limit: raw.per_person_qty_limit,
    over_limit_unit_price: raw.over_limit_unit_price,
  });
  if (!limits.ok) {
    return { error: limits.error, status: 400 };
  }

  return {
    name_pt: raw.name_pt,
    name_en: typeof raw.name_en === 'string' ? raw.name_en : null,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : null,
    description_pt: typeof raw.description_pt === 'string' ? raw.description_pt : null,
    description_en: typeof raw.description_en === 'string' ? raw.description_en : null,
    description_zh: typeof raw.description_zh === 'string' ? raw.description_zh : null,
    price,
    vat_rate: vatRate,
    category_id: raw.category_id,
    item_code: raw.item_code,
    print_station_ids: parseMenuItemPrintStationIds(raw.print_station_ids),
    emoji: raw.emoji,
    available: raw.available !== false,
    note_preset_group_ids: raw.note_preset_group_ids,
    allergen_codes: allergenCodes,
    flavor_codes: flavorCodes,
    is_vegetarian: raw.is_vegetarian === true,
    station_print_pt: raw.station_print_pt !== false,
    station_print_en: raw.station_print_en === true,
    station_print_zh: raw.station_print_zh === true,
    per_person_qty_limit: limits.per_person_qty_limit,
    over_limit_unit_price: limits.over_limit_unit_price,
    time_slot_id: timeSlotId,
    takeaway_role: (() => {
      const role = raw.takeaway_role;
      if (
        role === 'sellable' ||
        role === 'packaging' ||
        role === 'none' ||
        role === 'takeaway_only'
      ) {
        return role;
      }
      return 'none';
    })(),
    takeaway_price: (() => {
      if (raw.takeaway_price == null || raw.takeaway_price === '') return null;
      const n =
        typeof raw.takeaway_price === 'number'
          ? raw.takeaway_price
          : Number(raw.takeaway_price);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

/** Sole body parser for dish station binding (empty array = inherit). */
export function parseMenuItemPrintStationIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const id = parseTableIdParam(entry);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export async function listRecommendedMenuItemIds(
  admin: SupabaseClient,
  restaurantId: string,
): Promise<string[] | MenuMutationError> {
  const { data, error } = await admin
    .from('menu_recommended_items')
    .select('menu_item_id')
    .eq('restaurant_id', restaurantId)
    .order('sort_order');
  if (error) {
    return { error: 'recommended_query_failed', message: error.message, status: 500 };
  }
  return (data || []).map((row) => String(row.menu_item_id));
}

function parseRecommendedMenuItemId(raw: unknown): string | MenuMutationError {
  const id = parseTableIdParam(raw);
  if (!id) return { error: 'invalid_menu_item_id', status: 400 };
  return id;
}

export async function addRecommendedMenuItems(
  admin: SupabaseClient,
  restaurantId: string,
  menuItemIdsRaw: unknown,
): Promise<{ recommended_item_ids: string[] } | MenuMutationError> {
  const menuItemIds = parseRecommendedMenuItemIds(menuItemIdsRaw);
  if (!menuItemIds) {
    return { error: 'invalid_menu_item_ids', status: 400 };
  }

  const existing = await listRecommendedMenuItemIds(admin, restaurantId);
  if (!Array.isArray(existing)) return existing;
  if (menuItemIds.some((id) => existing.includes(id))) {
    return { error: 'already_recommended', status: 409 };
  }
  if (existing.length + menuItemIds.length > MENU_RECOMMENDED_ITEMS_MAX) {
    return { error: 'recommended_limit', status: 400 };
  }

  const { data: found, error: itemError } = await admin
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .in('id', menuItemIds);
  if (itemError) {
    return { error: 'menu_items_query_failed', message: itemError.message, status: 500 };
  }
  const foundIds = new Set((found || []).map((row) => String(row.id)));
  if (menuItemIds.some((id) => !foundIds.has(id))) {
    return { error: 'item_not_found', status: 404 };
  }

  const { data: sortRows, error: sortError } = await admin
    .from('menu_recommended_items')
    .select('sort_order')
    .eq('restaurant_id', restaurantId);
  if (sortError) {
    return { error: 'recommended_query_failed', message: sortError.message, status: 500 };
  }

  const baseSort = nextSortOrder(sortRows || []);
  const { error } = await admin.from('menu_recommended_items').insert(
    menuItemIds.map((menuItemId, index) => ({
      restaurant_id: restaurantId,
      menu_item_id: menuItemId,
      sort_order: baseSort + index,
    })),
  );
  if (error) {
    return {
      error: uniqueViolation(error) ? 'already_recommended' : 'recommended_insert_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  const next = await listRecommendedMenuItemIds(admin, restaurantId);
  if (!Array.isArray(next)) return next;
  return { recommended_item_ids: next };
}

export async function removeRecommendedMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  menuItemIdRaw: unknown,
): Promise<{ recommended_item_ids: string[] } | MenuMutationError> {
  const menuItemId = parseRecommendedMenuItemId(menuItemIdRaw);
  if (typeof menuItemId !== 'string') return menuItemId;

  const { data, error } = await admin
    .from('menu_recommended_items')
    .delete()
    .eq('restaurant_id', restaurantId)
    .eq('menu_item_id', menuItemId)
    .select('id');
  if (error) {
    return { error: 'recommended_delete_failed', message: error.message, status: 500 };
  }
  if (!data?.length) {
    return { error: 'recommended_not_found', status: 404 };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  const next = await listRecommendedMenuItemIds(admin, restaurantId);
  if (!Array.isArray(next)) return next;
  return { recommended_item_ids: next };
}

export async function reorderRecommendedMenuItems(
  admin: SupabaseClient,
  restaurantId: string,
  orderedIdsRaw: unknown,
): Promise<{ recommended_item_ids: string[] } | MenuMutationError> {
  if (!Array.isArray(orderedIdsRaw) || orderedIdsRaw.length === 0) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }
  const orderedIds: string[] = [];
  for (const raw of orderedIdsRaw) {
    const id = parseTableIdParam(raw);
    if (!id) return { error: 'invalid_ordered_ids', status: 400 };
    orderedIds.push(id);
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    return { error: 'invalid_ordered_ids', status: 400 };
  }

  const { data: rows, error } = await admin
    .from('menu_recommended_items')
    .select('id, menu_item_id, sort_order')
    .eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'recommended_query_failed', message: error.message, status: 500 };
  }
  const siblingRows = rows ?? [];
  const byMenuItemId = new Map(siblingRows.map((row) => [String(row.menu_item_id), row]));
  if (
    siblingRows.length !== orderedIds.length ||
    orderedIds.some((id) => !byMenuItemId.has(id))
  ) {
    return { error: 'reorder_scope_mismatch', status: 400 };
  }

  const joinOrderedIds = orderedIds.map((id) => byMenuItemId.get(id)!.id);
  if (!orderedIdsMatchSiblingSet(siblingRows, joinOrderedIds)) {
    return { error: 'reorder_scope_mismatch', status: 400 };
  }

  const scopeMax =
    siblingRows.length === 0 ? -1 : Math.max(...siblingRows.map((row) => row.sort_order));
  const persisted = await persistZeroBasedSortOrders(
    admin,
    'menu_recommended_items',
    restaurantId,
    joinOrderedIds,
    scopeMax,
  );
  if ('error' in persisted) {
    return { error: persisted.error, message: persisted.message, status: 500 };
  }

  await invalidateCustomerMenuCatalog(restaurantId);
  return { recommended_item_ids: orderedIds };
}
