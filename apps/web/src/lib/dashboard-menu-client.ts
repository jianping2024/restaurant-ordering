import { restaurantApiPath } from '@/lib/dashboard-store-routes';
import type { MenuCategory, MenuItem, PrintStation } from '@/types';
import type { MenuNotePreset, MenuNotePresetGroup } from '@/lib/menu-note-presets';
import { MAX_MENU_CATEGORY_DEPTH } from '@/lib/menu-admin';
import { DISH_VIDEO_MIME, type DishVideoEffect } from '@/lib/menu-dish-video';

type ApiError = { error: string; message?: string; referenced_item_count?: number };

async function parseJson<T>(res: Response): Promise<T & ApiError> {
  return (await res.json().catch(() => ({}))) as T & ApiError;
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; message?: string; referenced_item_count?: number }
> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    const data = await parseJson<T>(res);
    if (!res.ok) {
      return {
        ok: false,
        error: data.error || 'request_failed',
        message: data.message,
        referenced_item_count: data.referenced_item_count,
      };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

export type MenuCategoryErrorLabels = {
  errCategoryCodeRequired: string;
  errCategoryCodeDuplicate: string;
  ptNameRequired: string;
  depthExceeded: string;
  errMigrateTargetInSubtree: string;
  categoryReorderStale: string;
  errDeleteCategoryItemsInUse: string;
  saveFail: string;
};

export type MenuItemErrorLabels = {
  errItemCodeRequired: string;
  errItemCodeDuplicate: string;
  ptNameRequired: string;
  validPrice: string;
  vatRateRequired: string;
  categoryRequired: string;
  imageTypeInvalid: string;
  dishReorderScopeMismatch: string;
  saveFail: string;
  errDeleteItemInUse: string;
  errDeleteFail: string;
  invalidPerPersonLimit?: string;
  invalidOverLimitPrice?: string;
  limitRequiresOveragePrice?: string;
  errTimeSlotNotFound: string;
  errDishVideoForbidden?: string;
  errInvalidVideo?: string;
  buffetPriceInvalid: string;
};

export function mapMenuCategoryApiError(
  code: string,
  message: string | undefined,
  labels: MenuCategoryErrorLabels,
): string {
  switch (code) {
    case 'category_code_required':
      return labels.errCategoryCodeRequired;
    case 'category_code_duplicate':
      return labels.errCategoryCodeDuplicate;
    case 'name_pt_required':
      return labels.ptNameRequired;
    case 'category_depth_exceeded':
      return labels.depthExceeded
        .replace('{max}', String(MAX_MENU_CATEGORY_DEPTH))
        .replace('{depth}', String(MAX_MENU_CATEGORY_DEPTH));
    case 'migrate_target_in_subtree':
      return labels.errMigrateTargetInSubtree;
    case 'reorder_scope_mismatch':
      return labels.categoryReorderStale;
    case 'menu_item_in_use':
      return labels.errDeleteCategoryItemsInUse;
    default:
      return message || labels.saveFail;
  }
}

export function mapMenuItemApiError(
  code: string,
  message: string | undefined,
  labels: MenuItemErrorLabels,
): string {
  switch (code) {
    case 'item_code_required':
      return labels.errItemCodeRequired;
    case 'item_code_duplicate':
      return labels.errItemCodeDuplicate;
    case 'name_pt_required':
      return labels.ptNameRequired;
    case 'invalid_price':
      return labels.validPrice;
    case 'invalid_vat_rate':
      return labels.vatRateRequired;
    case 'category_not_found':
    case 'invalid_category_id':
      return labels.categoryRequired;
    case 'invalid_image':
      return labels.imageTypeInvalid;
    case 'dish_video_forbidden':
      return labels.errDishVideoForbidden || labels.saveFail;
    case 'invalid_video':
      return labels.errInvalidVideo || labels.saveFail;
    case 'cleanup_failed':
      return message || labels.saveFail;
    case 'reorder_scope_mismatch':
      return labels.dishReorderScopeMismatch;
    case 'invalid_per_person_qty_limit':
      return labels.invalidPerPersonLimit || labels.saveFail;
    case 'invalid_over_limit_unit_price':
      return labels.invalidOverLimitPrice || labels.validPrice;
    case 'limit_requires_overage_price':
      return labels.limitRequiresOveragePrice || labels.saveFail;
    case 'time_slot_not_found':
    case 'invalid_time_slot_id':
      return labels.errTimeSlotNotFound;
    case 'menu_item_in_use':
      return labels.errDeleteItemInUse;
    case 'invalid_buffet_prices':
    case 'buffet_prices_require_dine_in':
      return labels.buffetPriceInvalid;
    case 'delete_failed':
      return labels.errDeleteFail;
    default:
      return message || labels.saveFail;
  }
}

export type CreateCategoryInput = {
  parent_id?: string | null;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  item_code: string;
  print_station_id?: string | null;
};

export type UpdateCategoryInput = {
  category_id: string;
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  item_code: string;
  print_station_id?: string | null;
};

export type DeleteCategoryInput = {
  category_id: string;
  mode: 'empty' | 'migrate' | 'delete_all';
  migrate_target_id?: string | null;
};

export type MenuItemMutationInput = {
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
  print_station_ids?: string[];
  emoji: string;
  available: boolean;
  note_preset_group_ids: string[];
  allergen_codes: string[];
  flavor_codes: string[];
  choice_bindings?: import('@/lib/menu-choice-options').MenuChoiceBinding[];
  topping_binding?: import('@/lib/menu-topping-binding').MenuToppingBinding | null;
  is_vegetarian?: boolean;
  station_print_pt?: boolean;
  station_print_en?: boolean;
  station_print_zh?: boolean;
  per_person_qty_limit?: number | null;
  over_limit_unit_price?: number | null;
  /** Null = all day. Always sent so an edit can clear a slot. */
  time_slot_id: string | null;
  takeaway_role?: 'none' | 'sellable' | 'takeaway_only' | 'packaging';
  takeaway_price?: number | null;
  /** Whole per-buffet price set for this dish (replaced on save). */
  buffet_prices: import('@/lib/menu-item-buffet-prices').MenuItemBuffetPriceInput[];
};

export type PrintStationInput = {
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  kitchen_enabled?: boolean;
};

export async function createMenuCategoryClient(slug: string, input: CreateCategoryInput) {
  return request<{ category: MenuCategory }>(restaurantApiPath(slug, '/menu/categories'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMenuCategoryClient(slug: string, input: UpdateCategoryInput) {
  return request<{ category: MenuCategory }>(restaurantApiPath(slug, '/menu/categories'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteMenuCategoryClient(slug: string, input: DeleteCategoryInput) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/categories'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function reorderMenuCategoriesClient(
  slug: string,
  parentId: string | null,
  orderedIds: string[],
) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/categories'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'reorder',
      parent_id: parentId,
      ordered_ids: orderedIds,
    }),
  });
}

export async function createMenuItemClient(slug: string, input: MenuItemMutationInput) {
  return request<{ item: MenuItem; buffet_prices: Record<string, number> }>(restaurantApiPath(slug, '/menu/items'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMenuItemClient(slug: string, itemId: string, input: MenuItemMutationInput) {
  return request<{ item: MenuItem; buffet_prices: Record<string, number> }>(restaurantApiPath(slug, '/menu/items'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, ...input }),
  });
}

export async function deleteMenuItemClient(slug: string, itemId: string) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/items'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
  });
}

export async function batchSetMenuItemsAvailableClient(slug: string, itemIds: string[], available: boolean) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/items'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batch_available', item_ids: itemIds, available }),
  });
}

export async function reorderMenuItemsClient(slug: string, orderedIds: string[]) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/items'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', ordered_ids: orderedIds }),
  });
}

export async function setMenuItemImageClient(
  slug: string,
  itemId: string,
  options: {
    file?: File | null;
    stripImage?: boolean;
    /** Both guest variants from `encodeDishVideos` + the effect they were made with. */
    video?: { detail: Blob; rail: Blob; effect: DishVideoEffect } | null;
    stripVideo?: boolean;
  },
) {
  const form = new FormData();
  if (options.stripImage) form.set('strip_image', '1');
  if (options.file) form.set('file', options.file);
  if (options.stripVideo) form.set('strip_video', '1');
  if (options.video) {
    form.set('video', new File([options.video.detail], 'detail.mp4', { type: DISH_VIDEO_MIME }));
    form.set('rail_video', new File([options.video.rail], 'rail.mp4', { type: DISH_VIDEO_MIME }));
    form.set('video_effect', options.video.effect);
  }
  return request<{ item: MenuItem }>(restaurantApiPath(slug, `/menu/items/${encodeURIComponent(itemId)}/image`), {
    method: 'POST',
    body: form,
  });
}

export async function createPrintStationClient(slug: string, input: PrintStationInput) {
  return request<{ station: PrintStation }>(restaurantApiPath(slug, '/menu/print-stations'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updatePrintStationClient(slug: string, stationId: string, input: PrintStationInput) {
  return request<{ station: PrintStation }>(restaurantApiPath(slug, '/menu/print-stations'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ station_id: stationId, ...input }),
  });
}

export async function reorderPrintStationsClient(slug: string, orderedIds: string[]) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/print-stations'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', ordered_ids: orderedIds }),
  });
}

export async function deletePrintStationClient(slug: string, stationId: string) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/print-stations'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ station_id: stationId }),
  });
}

export type RecommendedMenuErrorLabels = {
  saveFail: string;
  recommendedAlready: string;
  recommendedMax: string;
  recommendedMissing: string;
  dishReorderScopeMismatch: string;
};

export function mapRecommendedMenuApiError(
  code: string,
  message: string | undefined,
  labels: RecommendedMenuErrorLabels,
): string {
  switch (code) {
    case 'already_recommended':
      return labels.recommendedAlready;
    case 'recommended_limit':
      return labels.recommendedMax;
    case 'invalid_menu_item_ids':
      return labels.saveFail;
    case 'item_not_found':
    case 'recommended_not_found':
      return labels.recommendedMissing;
    case 'reorder_scope_mismatch':
      return labels.dishReorderScopeMismatch;
    default:
      return message || labels.saveFail;
  }
}

export type NotePresetErrorLabels = {
  saveFail: string;
  notePresetGroupNotEmpty: string;
  notePresetDictHint: string;
};

/** Sole user-facing mapper for note-preset dictionary API error codes. */
export function mapNotePresetApiError(
  code: string,
  message: string | undefined,
  labels: NotePresetErrorLabels,
  count?: number,
): string {
  switch (code) {
    case 'note_preset_group_not_empty':
      return labels.notePresetGroupNotEmpty.replace('{count}', String(count ?? '?'));
    case 'note_preset_en_pt_required':
    case 'invalid_note_preset_names':
      return labels.notePresetDictHint;
    default:
      return message || labels.saveFail;
  }
}

export async function addRecommendedMenuItemsClient(slug: string, menuItemIds: string[]) {
  return request<{ recommended_item_ids: string[] }>(restaurantApiPath(slug, '/menu/recommended'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menu_item_ids: menuItemIds }),
  });
}

export async function removeRecommendedMenuItemClient(slug: string, menuItemId: string) {
  return request<{ recommended_item_ids: string[] }>(restaurantApiPath(slug, '/menu/recommended'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menu_item_id: menuItemId }),
  });
}

export async function reorderRecommendedMenuItemsClient(slug: string, orderedIds: string[]) {
  return request<{ recommended_item_ids: string[] }>(restaurantApiPath(slug, '/menu/recommended'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', ordered_ids: orderedIds }),
  });
}

export type NotePresetNameInput = {
  name_en: string;
  name_pt: string;
  name_zh?: string;
};

export async function createNotePresetGroupClient(slug: string, input: NotePresetNameInput) {
  return request<{ group: MenuNotePresetGroup }>(restaurantApiPath(slug, '/menu/note-preset-groups'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateNotePresetGroupClient(
  slug: string,
  groupId: string,
  patch: NotePresetNameInput & { active?: boolean },
) {
  return request<{ group: MenuNotePresetGroup }>(restaurantApiPath(slug, '/menu/note-preset-groups'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId, ...patch }),
  });
}

export async function setNotePresetGroupActiveClient(slug: string, groupId: string, active: boolean) {
  return request<{ group: MenuNotePresetGroup }>(restaurantApiPath(slug, '/menu/note-preset-groups'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId, active }),
  });
}

export async function deleteNotePresetGroupClient(slug: string, groupId: string) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/note-preset-groups'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId }),
  });
}

export async function reorderNotePresetGroupsClient(slug: string, orderedIds: string[]) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/note-preset-groups'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', ordered_ids: orderedIds }),
  });
}

export async function createNotePresetClient(slug: string, groupId: string, input: NotePresetNameInput) {
  return request<{ preset: MenuNotePreset }>(restaurantApiPath(slug, '/menu/note-presets'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group_id: groupId, ...input }),
  });
}

export async function updateNotePresetClient(
  slug: string,
  presetId: string,
  patch: NotePresetNameInput & { active?: boolean; group_id?: string },
) {
  return request<{ preset: MenuNotePreset }>(restaurantApiPath(slug, '/menu/note-presets'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset_id: presetId, ...patch }),
  });
}

export async function setNotePresetActiveClient(slug: string, presetId: string, active: boolean) {
  return request<{ preset: MenuNotePreset }>(restaurantApiPath(slug, '/menu/note-presets'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset_id: presetId, active }),
  });
}

export async function deleteNotePresetClient(slug: string, presetId: string, confirmUnbind = false) {
  return request<{ ok: true; referenced_item_count: number }>(restaurantApiPath(slug, '/menu/note-presets'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset_id: presetId, confirm_unbind: confirmUnbind }),
  });
}

export async function reorderNotePresetsClient(slug: string, groupId: string, orderedIds: string[]) {
  return request<{ ok: true }>(restaurantApiPath(slug, '/menu/note-presets'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reorder', group_id: groupId, ordered_ids: orderedIds }),
  });
}

