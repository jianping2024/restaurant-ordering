import type { MenuCategory, MenuItem } from '@/types';

/** Product cap for the curated recommended list (dashboard write + picker). */
export const MENU_RECOMMENDED_ITEMS_MAX = 12;

/**
 * Customer category-strip sentinel. Not a `menu_categories.id`.
 * Sole customer merchandising entry for recommended dishes.
 */
export const CUSTOMER_MENU_RECOMMENDED_CATEGORY_ID = 'recommended';

export type CustomerMenuCatalogView = {
  realTopCategories: MenuCategory[];
  recommendedItems: MenuItem[];
  currentTopId: string;
  subCategories: MenuCategory[];
  currentSubpath: string;
  currentItems: MenuItem[];
};

function collectDescendantIds(
  rootId: string,
  childrenByParent: Map<string, string[]>,
): Set<string> {
  const ids = new Set<string>();
  const walk = (id: string) => {
    const children = childrenByParent.get(id) || [];
    children.forEach((childId) => {
      if (ids.has(childId)) return;
      ids.add(childId);
      walk(childId);
    });
  };
  walk(rootId);
  return ids;
}

/** Available recommended dishes in dashboard-curated order. */
export function visibleRecommendedMenuItems(
  menuItems: readonly MenuItem[],
  recommendedItemIds: readonly string[],
): MenuItem[] {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const out: MenuItem[] = [];
  for (const id of recommendedItemIds) {
    const item = byId.get(id);
    if (item?.available) out.push(item);
  }
  return out;
}

function itemsForCategoryScope(params: {
  menuItems: readonly MenuItem[];
  childrenByParent: Map<string, string[]>;
  currentTop: string;
  currentSubpath: string;
}): MenuItem[] {
  const { menuItems, childrenByParent, currentTop, currentSubpath } = params;
  return menuItems.filter((item) => {
    if (!currentTop) return true;
    if (!item.category_id) return false;
    if (currentSubpath) {
      if (item.category_id === currentSubpath) return true;
      return collectDescendantIds(currentSubpath, childrenByParent).has(item.category_id);
    }
    if (item.category_id === currentTop) return true;
    return collectDescendantIds(currentTop, childrenByParent).has(item.category_id);
  });
}

/**
 * Sole customer menu category + item selection (classic + sushi).
 * Recommended is a virtual first top category when any curated dish is available.
 */
export function resolveCustomerMenuCatalogView(params: {
  menuCategories: readonly MenuCategory[];
  menuItems: readonly MenuItem[];
  recommendedItemIds: readonly string[];
  activeTopId: string;
  activeSubpath: string;
}): CustomerMenuCatalogView {
  const realTopCategories = params.menuCategories
    .filter((c) => !c.parent_id && c.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const recommendedItems = visibleRecommendedMenuItems(
    params.menuItems,
    params.recommendedItemIds,
  );
  const defaultTop =
    recommendedItems.length > 0 ? CUSTOMER_MENU_RECOMMENDED_CATEGORY_ID : (realTopCategories[0]?.id || '');
  const knownTops = new Set<string>([
    ...(recommendedItems.length > 0 ? [CUSTOMER_MENU_RECOMMENDED_CATEGORY_ID] : []),
    ...realTopCategories.map((c) => c.id),
  ]);
  const currentTopId = knownTops.has(params.activeTopId) ? params.activeTopId : defaultTop;

  const childrenByParent = new Map<string, string[]>();
  params.menuCategories
    .filter((c) => c.active && c.parent_id)
    .forEach((category) => {
      const parentId = category.parent_id as string;
      const list = childrenByParent.get(parentId) || [];
      list.push(category.id);
      childrenByParent.set(parentId, list);
    });

  if (currentTopId === CUSTOMER_MENU_RECOMMENDED_CATEGORY_ID) {
    return {
      realTopCategories,
      recommendedItems,
      currentTopId,
      subCategories: [],
      currentSubpath: '',
      currentItems: recommendedItems,
    };
  }

  const subCategories = params.menuCategories
    .filter((c) => c.parent_id === currentTopId && c.active)
    .sort((a, b) => a.sort_order - b.sort_order);
  const currentSubpath = subCategories.some((c) => c.id === params.activeSubpath)
    ? params.activeSubpath
    : '';

  return {
    realTopCategories,
    recommendedItems,
    currentTopId,
    subCategories,
    currentSubpath,
    currentItems: itemsForCategoryScope({
      menuItems: params.menuItems,
      childrenByParent,
      currentTop: currentTopId,
      currentSubpath,
    }),
  };
}

export function customerMenuStripTopCategories(
  view: CustomerMenuCatalogView,
  recommendedLabel: string,
  labelForCategory: (category: MenuCategory) => string,
): { id: string; label: string }[] {
  const real = view.realTopCategories.map((cat) => ({
    id: cat.id,
    label: labelForCategory(cat),
  }));
  if (view.recommendedItems.length === 0) return real;
  return [{ id: CUSTOMER_MENU_RECOMMENDED_CATEGORY_ID, label: recommendedLabel }, ...real];
}
