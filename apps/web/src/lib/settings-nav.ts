import { can, type Capabilities } from '@/lib/permissions/can';
import {
  dashboardPageMatches,
  dashboardStorePage,
  type DashboardPagePath,
} from '@/lib/dashboard-store-routes';

/** Full store pathname under a store-relative settings page. */
function storePageUnder(pathname: string, page: DashboardPagePath): boolean {
  const current = dashboardStorePage(pathname);
  return current != null && dashboardPageMatches(current, page);
}
import type { PermissionKey } from '@/lib/permissions/registry';

export type SettingsNavId =
  | 'profile'
  | 'features'
  | 'staff'
  | 'roles'
  | 'buffet'
  | 'print-assistant'
  | 'kitchen-screens'
  | 'system-logs';

export type SettingsHubLabelKey =
  | 'tabProfile'
  | 'tabFeatures'
  | 'tabStaff'
  | 'tabRoles'
  | 'tabBuffet'
  | 'tabPrintAssistant'
  | 'tabKitchenScreens'
  | 'tabSystemLogs';

export type SettingsHubHintKey =
  | 'hintProfile'
  | 'hintFeatures'
  | 'hintBuffet'
  | 'hintPrintAssistant'
  | 'hintKitchenScreens'
  | 'hintSystemLogs';

export type SettingsNavItem = {
  id: SettingsNavId;
  /** Store-relative page (`dashboardStoreHref(slug, page)`). */
  page: DashboardPagePath;
  labelKey: SettingsHubLabelKey;
  hintKey?: SettingsHubHintKey;
  icon: string;
  /** Capability gate; omit when backendAdminOnPremOnly. */
  permission?: PermissionKey;
  /**
   * Visible only when local-perm + restaurants.owner_id (后台管理员).
   * Not a grantable permission — sole access representation with canAccessSystemLogs.
   */
  backendAdminOnPremOnly?: boolean;
  isActive: (pathname: string) => boolean;
};

export const SETTINGS_NAV_TABS: SettingsNavItem[] = [
  {
    id: 'profile',
    page: '/settings',
    labelKey: 'tabProfile',
    hintKey: 'hintProfile',
    icon: '🏪',
    permission: 'settings.profile.manage',
    isActive: (pathname) => dashboardStorePage(pathname) === '/settings',
  },
  {
    id: 'staff',
    page: '/settings/staff',
    labelKey: 'tabStaff',
    icon: '👥',
    permission: 'settings.staff.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/staff'),
  },
  {
    id: 'roles',
    page: '/settings/roles',
    labelKey: 'tabRoles',
    icon: '🔐',
    permission: 'settings.roles.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/roles'),
  },
  {
    id: 'features',
    page: '/settings/features',
    labelKey: 'tabFeatures',
    hintKey: 'hintFeatures',
    icon: '🧩',
    permission: 'settings.features.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/features'),
  },
  {
    id: 'buffet',
    page: '/settings/buffet',
    labelKey: 'tabBuffet',
    hintKey: 'hintBuffet',
    icon: '🍽️',
    permission: 'settings.buffet.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/buffet'),
  },
  {
    id: 'print-assistant',
    page: '/settings/print-assistant',
    labelKey: 'tabPrintAssistant',
    hintKey: 'hintPrintAssistant',
    icon: '🖨️',
    permission: 'settings.print_assistant.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/print-assistant'),
  },
  {
    id: 'kitchen-screens',
    page: '/settings/kitchen-screens',
    labelKey: 'tabKitchenScreens',
    hintKey: 'hintKitchenScreens',
    icon: '📺',
    permission: 'floor.kitchen_screens.manage',
    isActive: (pathname) => storePageUnder(pathname, '/settings/kitchen-screens'),
  },
  {
    id: 'system-logs',
    page: '/settings/system-logs',
    labelKey: 'tabSystemLogs',
    hintKey: 'hintSystemLogs',
    icon: '📜',
    backendAdminOnPremOnly: true,
    isActive: (pathname) => storePageUnder(pathname, '/settings/system-logs'),
  },
];

export function getActiveSettingsNavItem(pathname: string): SettingsNavItem | null {
  return SETTINGS_NAV_TABS.find((item) => item.isActive(pathname)) ?? null;
}

export function isSettingsWideLayout(pathname: string): boolean {
  return storePageUnder(pathname, '/settings/buffet');
}

/**
 * First settings sub-route the principal can open (SETTINGS_NAV_TABS order).
 * Omits profile hub `/settings` itself — caller handles profile vs empty.
 */
export function firstAccessibleSettingsChildPage(capabilities: Capabilities): DashboardPagePath | null {
  for (const item of SETTINGS_NAV_TABS) {
    if (item.id === 'profile') continue;
    if (item.backendAdminOnPremOnly) continue;
    if (item.permission && can(capabilities, item.permission)) {
      return item.page;
    }
  }
  return null;
}

/** Sole settings-hub landing decision (used by the store `/settings` page). */
export type SettingsHubDestination =
  | { kind: 'profile' }
  | { kind: 'redirect'; page: DashboardPagePath }
  | { kind: 'empty' };

export function resolveSettingsHubDestination(
  capabilities: Capabilities,
): SettingsHubDestination {
  if (can(capabilities, 'settings.profile.manage')) return { kind: 'profile' };
  const childPage = firstAccessibleSettingsChildPage(capabilities);
  if (childPage) return { kind: 'redirect', page: childPage };
  return { kind: 'empty' };
}
