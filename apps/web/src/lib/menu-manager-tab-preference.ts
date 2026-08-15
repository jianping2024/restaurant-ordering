export type MenuManagerTab = 'stations' | 'categories' | 'items';

const KEY_PREFIX = 'mesa-menu-manager-tab:';

export const MENU_MANAGER_DEFAULT_TAB: MenuManagerTab = 'stations';

/** When stations tab is not permitted, land on categories. */
export const MENU_MANAGER_FALLBACK_TAB: MenuManagerTab = 'categories';

export function menuManagerTabStorageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

export function isMenuManagerTab(value: string | null | undefined): value is MenuManagerTab {
  return value === 'stations' || value === 'categories' || value === 'items';
}

export function resolveAllowedMenuManagerTab(
  tab: string | null | undefined,
  canManagePrintStations: boolean,
): MenuManagerTab {
  const raw = isMenuManagerTab(tab) ? tab : MENU_MANAGER_DEFAULT_TAB;
  if (raw === 'stations' && !canManagePrintStations) {
    return MENU_MANAGER_FALLBACK_TAB;
  }
  return raw;
}

export function loadSavedMenuManagerTab(restaurantId: string): MenuManagerTab | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(menuManagerTabStorageKey(restaurantId));
    return isMenuManagerTab(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveMenuManagerTab(restaurantId: string, tab: MenuManagerTab): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(menuManagerTabStorageKey(restaurantId), tab);
  } catch {
    /* ignore quota / private mode */
  }
}

export function menuManagerTabQuery(tab: MenuManagerTab): string {
  return tab === MENU_MANAGER_DEFAULT_TAB ? '' : `?tab=${tab}`;
}

export function menuManagerPath(tab: MenuManagerTab): string {
  return `/dashboard/menu${menuManagerTabQuery(tab)}`;
}
