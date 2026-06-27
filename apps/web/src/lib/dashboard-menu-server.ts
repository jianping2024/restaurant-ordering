import type { SupabaseClient } from '@supabase/supabase-js';
import {
  collectCategorySubtreeIds,
  MAX_MENU_CATEGORY_DEPTH,
  sortCategoryIdsLeavesFirst,
} from '@/lib/menu-admin';
import { menuItemHasDuplicateCode, siblingCategoryHasDuplicateCode } from '@/lib/menu-code-uniqueness';
import {
  MENU_IMAGE_MAX_BYTES,
  menuImageObjectPath,
  pathFromMenuImagePublicUrl,
} from '@/lib/menu-image';
import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import {
  isAllowedMenuVatRate,
  parseMenuVatRate,
} from '@/lib/menu-vat-rate';
import { parseTableIdParam } from '@/lib/restaurant-tables';
import { nextSortOrder, sortBySortOrderThenCreatedAt, type SortOrderMoveDirection } from '@/lib/sort-order';
import { persistAdjacentSortOrderMove } from '@/lib/sort-order-persist';
import type { MenuCategory, MenuItem, PrintStation, PrintStationTicketLayout } from '@/types';

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const PRINT_STATION_LAYOUTS = new Set<PrintStationTicketLayout>(['kitchen', 'beverage', 'standard']);

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
  ticket_layout: PrintStationTicketLayout;
};

function uniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
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

  const siblings = categories.filter((c) => (c.parent_id || null) === parentId);
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

  return { category: data as MenuCategory };
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
    const { error: moveError } = await admin
      .from('menu_items')
      .update({
        category_id: target.id,
        category: target.name_pt,
        category_en: target.name_en || target.name_pt,
        category_zh: target.name_zh || target.name_pt,
      })
      .eq('restaurant_id', restaurantId)
      .in('category_id', subtreeIds);
    if (moveError) {
      return { error: 'migrate_failed', message: moveError.message, status: 500 };
    }
  } else if (linkedInSubtree.length > 0) {
    if (input.mode !== 'delete_all') {
      return { error: 'category_has_linked_items', status: 409 };
    }
    for (const item of linkedInSubtree) {
      await removeMenuImage(admin, item.image_url);
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

  return { ok: true };
}

type MenuItemInput = {
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  description_pt?: string | null;
  description_en?: string | null;
  price: number;
  vat_rate: number;
  category_id: string;
  item_code: string;
  print_station_id?: string | null;
  emoji: string;
  available: boolean;
  note_preset_keys: string[];
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
    price: input.price,
    vat_rate: input.vat_rate,
    category_id: category.id,
    category: category.name_pt,
    category_en: category.name_en || category.name_pt,
    category_zh: category.name_zh || category.name_pt,
    emoji: input.emoji,
    available: input.available,
    note_preset_keys: input.note_preset_keys,
    print_station_id: input.print_station_id || null,
    item_code: normalizedCode,
  };
}

export async function createMenuItem(
  admin: SupabaseClient,
  restaurantId: string,
  input: MenuItemInput,
): Promise<{ item: MenuItem } | MenuMutationError> {
  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;
  const items = await loadMenuItems(admin, restaurantId);
  if ('error' in items) return items;

  const categoryOrError = validateMenuItemInput(input, items, categories);
  if ('error' in categoryOrError) return categoryOrError;
  const category = categoryOrError;

  const normalizedCode = normalizeMenuItemCode(input.item_code)!;
  const categoryItems = items.filter((i) => i.category_id === category.id);
  const { data, error } = await admin
    .from('menu_items')
    .insert({
      ...buildMenuItemPayload(restaurantId, category, input, normalizedCode),
      sort_order: nextSortOrder(categoryItems),
    })
    .select()
    .single();

  if (error) {
    return {
      error: uniqueViolation(error) ? 'item_code_duplicate' : 'insert_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

  return { item: data as MenuItem };
}

export async function moveMenuItemOrder(
  admin: SupabaseClient,
  restaurantId: string,
  itemId: string,
  direction: SortOrderMoveDirection,
): Promise<{ ok: true } | MenuMutationError> {
  const id = parseTableIdParam(itemId);
  if (!id) {
    return { error: 'invalid_item_id', status: 400 };
  }

  const { data: item, error: itemError } = await admin
    .from('menu_items')
    .select('id, sort_order, category_id, created_at')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (itemError) {
    return { error: 'menu_items_query_failed', message: itemError.message, status: 500 };
  }
  if (!item) {
    return { error: 'item_not_found', status: 404 };
  }

  let siblingsQuery = admin
    .from('menu_items')
    .select('id, sort_order, category_id, created_at')
    .eq('restaurant_id', restaurantId);
  siblingsQuery = item.category_id
    ? siblingsQuery.eq('category_id', item.category_id)
    : siblingsQuery.is('category_id', null);

  const { data: siblings, error: siblingsError } = await siblingsQuery;
  if (siblingsError) {
    return { error: 'menu_items_query_failed', message: siblingsError.message, status: 500 };
  }

  const ordered = sortBySortOrderThenCreatedAt(siblings ?? []);
  const index = ordered.findIndex((row) => row.id === id);
  if (index < 0) {
    return { error: 'item_not_found', status: 404 };
  }

  const neighborIndex = index + direction;
  if (neighborIndex < 0 || neighborIndex >= ordered.length) {
    return { error: 'move_out_of_range', status: 400 };
  }

  const a = ordered[index];
  const b = ordered[neighborIndex];
  const persisted = await persistAdjacentSortOrderMove(admin, 'menu_items', restaurantId, a, b, direction);
  if ('error' in persisted) {
    return { error: persisted.error, message: persisted.message, status: 500 };
  }

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

  const categories = await loadActiveCategories(admin, restaurantId);
  if ('error' in categories) return categories;
  const items = await loadMenuItems(admin, restaurantId);
  if ('error' in items) return items;

  const existing = items.find((item) => item.id === id && item.restaurant_id === restaurantId);
  if (!existing) {
    return { error: 'item_not_found', status: 404 };
  }

  const categoryOrError = validateMenuItemInput(input, items, categories, id);
  if ('error' in categoryOrError) return categoryOrError;
  const category = categoryOrError;

  const normalizedCode = normalizeMenuItemCode(input.item_code)!;
  const { data, error } = await admin
    .from('menu_items')
    .update(buildMenuItemPayload(restaurantId, category, input, normalizedCode))
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();

  if (error) {
    return {
      error: uniqueViolation(error) ? 'item_code_duplicate' : 'update_failed',
      message: error.message,
      status: uniqueViolation(error) ? 409 : 500,
    };
  }

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
    .select('id, image_url')
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .maybeSingle();
  if (queryError) {
    return { error: 'item_query_failed', message: queryError.message, status: 500 };
  }
  if (!item) {
    return { error: 'item_not_found', status: 404 };
  }

  await removeMenuImage(admin, item.image_url);
  const { error } = await admin.from('menu_items').delete().eq('id', id).eq('restaurant_id', restaurantId);
  if (error) {
    return { error: 'delete_failed', message: error.message, status: 500 };
  }
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
  return { ok: true };
}

async function removeMenuImage(
  admin: SupabaseClient,
  publicUrl: string | null | undefined,
): Promise<void> {
  if (!publicUrl) return;
  const path = pathFromMenuImagePublicUrl(publicUrl);
  if (!path) return;
  await admin.storage.from('menu-images').remove([path]);
}

export async function setMenuItemImage(
  admin: SupabaseClient,
  restaurantId: string,
  itemId: string,
  file: File | null,
  stripImage: boolean,
): Promise<{ item: MenuItem } | MenuMutationError> {
  const id = parseTableIdParam(itemId);
  if (!id) {
    return { error: 'invalid_item_id', status: 400 };
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

  let imageUrl: string | null | undefined;
  if (stripImage && !file) {
    await removeMenuImage(admin, existing.image_url);
    imageUrl = null;
  } else if (file) {
    if (!ALLOWED_IMAGE_MIME.has(file.type) || file.size > MENU_IMAGE_MAX_BYTES) {
      return { error: 'invalid_image', status: 400 };
    }
    await removeMenuImage(admin, existing.image_url);
    const path = menuImageObjectPath(restaurantId, id, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await admin.storage.from('menu-images').upload(path, buffer, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) {
      return { error: 'upload_failed', message: uploadError.message, status: 500 };
    }
    const { data: pub } = admin.storage.from('menu-images').getPublicUrl(path);
    imageUrl = pub.publicUrl;
  }

  if (imageUrl === undefined) {
    return { item: existing as MenuItem };
  }

  const { data, error } = await admin
    .from('menu_items')
    .update({ image_url: imageUrl })
    .eq('id', id)
    .eq('restaurant_id', restaurantId)
    .select()
    .single();
  if (error) {
    return { error: 'update_failed', message: error.message, status: 500 };
  }
  return { item: data as MenuItem };
}

export async function createPrintStation(
  admin: SupabaseClient,
  restaurantId: string,
  input: {
    name_pt: string;
    name_en?: string | null;
    name_zh?: string | null;
    ticket_layout: PrintStationTicketLayout;
  },
): Promise<{ station: PrintStation } | MenuMutationError> {
  const namePt = input.name_pt.trim();
  if (!namePt) {
    return { error: 'name_pt_required', status: 400 };
  }
  if (!PRINT_STATION_LAYOUTS.has(input.ticket_layout)) {
    return { error: 'invalid_ticket_layout', status: 400 };
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
      ticket_layout: input.ticket_layout,
      sort_order: nextSortOrder(rows ?? []),
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
    ticket_layout: PrintStationTicketLayout;
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
  if (!PRINT_STATION_LAYOUTS.has(input.ticket_layout)) {
    return { error: 'invalid_ticket_layout', status: 400 };
  }

  const { data, error } = await admin
    .from('print_stations')
    .update({
      name_pt: namePt,
      name_en: input.name_en?.trim() || null,
      name_zh: input.name_zh?.trim() || null,
      ticket_layout: input.ticket_layout,
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

export async function movePrintStationOrder(
  admin: SupabaseClient,
  restaurantId: string,
  stationId: string,
  direction: SortOrderMoveDirection,
): Promise<{ ok: true } | MenuMutationError> {
  const id = parseTableIdParam(stationId);
  if (!id) {
    return { error: 'invalid_station_id', status: 400 };
  }

  const { data: rows, error: listError } = await admin
    .from('print_stations')
    .select('id, sort_order, created_at')
    .eq('restaurant_id', restaurantId);
  if (listError) {
    return { error: 'print_stations_query_failed', message: listError.message, status: 500 };
  }

  const ordered = sortBySortOrderThenCreatedAt(rows ?? []);
  const index = ordered.findIndex((row) => row.id === id);
  if (index < 0) {
    return { error: 'station_not_found', status: 404 };
  }

  const neighborIndex = index + direction;
  if (neighborIndex < 0 || neighborIndex >= ordered.length) {
    return { error: 'move_out_of_range', status: 400 };
  }

  const a = ordered[index];
  const b = ordered[neighborIndex];
  const persisted = await persistAdjacentSortOrderMove(admin, 'print_stations', restaurantId, a, b, direction);
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
  if (typeof raw.name_pt !== 'string' || typeof raw.ticket_layout !== 'string') {
    return { error: 'invalid_station_body', status: 400 };
  }
  if (!PRINT_STATION_LAYOUTS.has(raw.ticket_layout as PrintStationTicketLayout)) {
    return { error: 'invalid_ticket_layout', status: 400 };
  }
  return {
    name_pt: raw.name_pt,
    name_en: typeof raw.name_en === 'string' ? raw.name_en : null,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : null,
    ticket_layout: raw.ticket_layout as PrintStationTicketLayout,
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
  if (!Array.isArray(raw.note_preset_keys) || raw.note_preset_keys.some((key) => typeof key !== 'string')) {
    return { error: 'invalid_item_body', status: 400 };
  }

  return {
    name_pt: raw.name_pt,
    name_en: typeof raw.name_en === 'string' ? raw.name_en : null,
    name_zh: typeof raw.name_zh === 'string' ? raw.name_zh : null,
    description_pt: typeof raw.description_pt === 'string' ? raw.description_pt : null,
    description_en: typeof raw.description_en === 'string' ? raw.description_en : null,
    price,
    vat_rate: vatRate,
    category_id: raw.category_id,
    item_code: raw.item_code,
    print_station_id: typeof raw.print_station_id === 'string' ? raw.print_station_id : null,
    emoji: raw.emoji,
    available: raw.available !== false,
    note_preset_keys: raw.note_preset_keys,
  };
}
