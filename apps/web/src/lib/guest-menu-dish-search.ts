import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import { normalizeMenuItemCode } from '@/lib/menu-print-label';
import type { Language, MenuCategory, MenuItem } from '@/types';

/** Cap suggestion rows so the overlay stays short on phones. */
export const GUEST_MENU_DISH_SEARCH_MAX_RESULTS = 8;

/** Brief gold highlight on the located list card. */
export const GUEST_MENU_DISH_LOCATE_HIGHLIGHT_MS = 1200;

export type GuestMenuDishSearchCandidate = {
  id: string;
  item: MenuItem;
  topCategoryId: string;
  topCategoryLabel: string;
};

/**
 * Searchable dishes = available items that appear in the live catalog nav
 * (`topCategoryIdByItemId`), with channel/slot display prices already on `servedItems`.
 */
export function buildGuestMenuDishSearchCandidates(params: {
  servedItems: readonly MenuItem[];
  topCategoryIdByItemId: ReadonlyMap<string, string>;
  topCategories: readonly MenuCategory[];
  lang: Language;
  labelForCategory: (category: MenuCategory) => string;
}): GuestMenuDishSearchCandidate[] {
  const labelByTopId = new Map(
    params.topCategories.map((cat) => [cat.id, params.labelForCategory(cat)] as const),
  );
  const out: GuestMenuDishSearchCandidate[] = [];
  for (const item of params.servedItems) {
    if (!item.available) continue;
    const topCategoryId = params.topCategoryIdByItemId.get(item.id);
    if (!topCategoryId) continue;
    out.push({
      id: item.id,
      item,
      topCategoryId,
      topCategoryLabel: labelByTopId.get(topCategoryId) ?? '',
    });
  }
  return out;
}

function scoreCandidate(query: string, candidate: GuestMenuDishSearchCandidate, lang: Language): number {
  const code = (normalizeMenuItemCode(candidate.item.item_code) ?? '').toLowerCase();
  const name = resolveMenuItemLocalizedName(candidate.item, lang).toLowerCase();
  if (code && code === query) return 400;
  if (code && code.startsWith(query)) return 300;
  if (name.startsWith(query)) return 200;
  if (name.includes(query)) return 100;
  if (code && code.includes(query)) return 50;
  return 0;
}

/**
 * Match by item code and UI-language dish name. Exact/prefix code ranks above name;
 * ties keep catalog (servedItems) order. Empty query → [].
 */
export function matchGuestMenuDishSearch(
  rawQuery: string,
  candidates: readonly GuestMenuDishSearchCandidate[],
  lang: Language,
  maxResults: number = GUEST_MENU_DISH_SEARCH_MAX_RESULTS,
): GuestMenuDishSearchCandidate[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const ranked: { score: number; index: number; candidate: GuestMenuDishSearchCandidate }[] = [];
  candidates.forEach((candidate, index) => {
    const score = scoreCandidate(query, candidate, lang);
    if (score <= 0) return;
    ranked.push({ score, index, candidate });
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, maxResults).map((row) => row.candidate);
}
