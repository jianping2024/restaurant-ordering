import { parseTableIdParam } from '@/lib/restaurant-tables';

/** Dish topping link — pick one menu category, then subset (empty item_ids = all). */
export type MenuToppingBinding = {
  category_id: string;
  item_ids: string[];
  required: boolean;
};

export type MenuToppingPick = {
  menu_item_id: string;
  qty: number;
};

export function normalizeToppingBinding(raw: unknown): MenuToppingBinding | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const category_id = parseTableIdParam(rec.category_id);
  if (!category_id) return null;
  const required = rec.required === true;
  const item_ids: string[] = [];
  if (Array.isArray(rec.item_ids)) {
    const seen = new Set<string>();
    for (const id of rec.item_ids) {
      const oid = parseTableIdParam(id);
      if (!oid || seen.has(oid)) continue;
      seen.add(oid);
      item_ids.push(oid);
    }
  }
  return { category_id, item_ids, required };
}

/** Resolve guest-selectable topping dishes for a main dish. */
export function resolveToppingMenuItems<T extends { id: string; category_id?: string | null; available?: boolean }>(
  binding: MenuToppingBinding | null | undefined,
  allItems: readonly T[],
  mainDishId: string,
): T[] {
  if (!binding) return [];
  const inCat = allItems.filter(
    (d) =>
      d.id !== mainDishId &&
      d.available !== false &&
      d.category_id === binding.category_id,
  );
  if (binding.item_ids.length === 0) return inCat;
  const allow = new Set(binding.item_ids);
  return inCat.filter((d) => allow.has(d.id));
}

export function toppingsSatisfied(
  binding: MenuToppingBinding | null | undefined,
  picks: readonly MenuToppingPick[],
): boolean {
  if (!binding?.required) return true;
  return picks.some((p) => p.qty > 0);
}
