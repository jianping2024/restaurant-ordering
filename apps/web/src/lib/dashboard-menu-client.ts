import type { MenuCategory, MenuItem, PrintStation, PrintStationTicketLayout } from '@/types';
import { MAX_MENU_CATEGORY_DEPTH } from '@/lib/menu-admin';

type ApiError = { error: string; message?: string };

async function parseJson<T>(res: Response): Promise<T & ApiError> {
  return (await res.json().catch(() => ({}))) as T & ApiError;
}

async function request<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; message?: string }> {
  try {
    const res = await fetch(url, { credentials: 'include', ...init });
    const data = await parseJson<T>(res);
    if (!res.ok) {
      return { ok: false, error: data.error || 'request_failed', message: data.message };
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
  reorderScopeMismatch: string;
  saveFail: string;
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
    case 'reorder_scope_mismatch':
      return labels.reorderScopeMismatch;
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
  price: number;
  vat_rate: number;
  category_id: string;
  item_code: string;
  print_station_id?: string | null;
  emoji: string;
  available: boolean;
  note_preset_keys: string[];
};

export type PrintStationInput = {
  name_pt: string;
  name_en?: string | null;
  name_zh?: string | null;
  ticket_layout: PrintStationTicketLayout;
};

export async function createMenuCategoryClient(input: CreateCategoryInput) {
  return request<{ category: MenuCategory }>('/api/dashboard/menu/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMenuCategoryClient(input: UpdateCategoryInput) {
  return request<{ category: MenuCategory }>('/api/dashboard/menu/categories', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteMenuCategoryClient(input: DeleteCategoryInput) {
  return request<{ ok: true }>('/api/dashboard/menu/categories', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function createMenuItemClient(input: MenuItemMutationInput) {
  return request<{ item: MenuItem }>('/api/dashboard/menu/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updateMenuItemClient(itemId: string, input: MenuItemMutationInput) {
  return request<{ item: MenuItem }>('/api/dashboard/menu/items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId, ...input }),
  });
}

export async function deleteMenuItemClient(itemId: string) {
  return request<{ ok: true }>('/api/dashboard/menu/items', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: itemId }),
  });
}

export async function batchSetMenuItemsAvailableClient(itemIds: string[], available: boolean) {
  return request<{ ok: true }>('/api/dashboard/menu/items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'batch_available', item_ids: itemIds, available }),
  });
}

export async function swapMenuItemOrderClient(itemIdA: string, itemIdB: string) {
  return request<{ ok: true }>('/api/dashboard/menu/items', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'swap_order', item_id_a: itemIdA, item_id_b: itemIdB }),
  });
}

export async function setMenuItemImageClient(
  itemId: string,
  options: { file?: File | null; stripImage?: boolean },
) {
  const form = new FormData();
  if (options.stripImage) form.set('strip_image', '1');
  if (options.file) form.set('file', options.file);
  return request<{ item: MenuItem }>(`/api/dashboard/menu/items/${encodeURIComponent(itemId)}/image`, {
    method: 'POST',
    body: form,
  });
}

export async function createPrintStationClient(input: PrintStationInput) {
  return request<{ station: PrintStation }>('/api/dashboard/menu/print-stations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function updatePrintStationClient(stationId: string, input: PrintStationInput) {
  return request<{ station: PrintStation }>('/api/dashboard/menu/print-stations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ station_id: stationId, ...input }),
  });
}

export async function swapPrintStationOrderClient(stationIdA: string, stationIdB: string) {
  return request<{ ok: true }>('/api/dashboard/menu/print-stations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'swap_order', station_id_a: stationIdA, station_id_b: stationIdB }),
  });
}

export async function deletePrintStationClient(stationId: string) {
  return request<{ ok: true }>('/api/dashboard/menu/print-stations', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ station_id: stationId }),
  });
}
