export type TablesManagerTab = 'tables' | 'groups';

const KEY_PREFIX = 'mesa-tables-manager-tab:';

export const TABLES_MANAGER_DEFAULT_TAB: TablesManagerTab = 'tables';

export function tablesManagerTabStorageKey(restaurantId: string): string {
  return `${KEY_PREFIX}${restaurantId}`;
}

export function isTablesManagerTab(value: string | null | undefined): value is TablesManagerTab {
  return value === 'tables' || value === 'groups';
}

export function parseTablesManagerTab(tab: string | undefined): TablesManagerTab {
  if (isTablesManagerTab(tab)) return tab;
  return TABLES_MANAGER_DEFAULT_TAB;
}

export function loadSavedTablesManagerTab(restaurantId: string): TablesManagerTab | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(tablesManagerTabStorageKey(restaurantId));
    return isTablesManagerTab(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveTablesManagerTab(restaurantId: string, tab: TablesManagerTab): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(tablesManagerTabStorageKey(restaurantId), tab);
  } catch {
    /* ignore */
  }
}

export function tablesManagerPath(tab: TablesManagerTab): string {
  return tab === TABLES_MANAGER_DEFAULT_TAB ? '/dashboard/tables' : `/dashboard/tables?tab=${tab}`;
}
