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
  href: string;
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
    href: '/dashboard/settings',
    labelKey: 'tabProfile',
    hintKey: 'hintProfile',
    icon: '🏪',
    permission: 'settings.profile.manage',
    isActive: (pathname) =>
      pathname === '/dashboard/settings' || pathname === '/dashboard/settings/',
  },
  {
    id: 'staff',
    href: '/dashboard/settings/staff',
    labelKey: 'tabStaff',
    icon: '👥',
    permission: 'settings.staff.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/staff'),
  },
  {
    id: 'roles',
    href: '/dashboard/settings/roles',
    labelKey: 'tabRoles',
    icon: '🔐',
    permission: 'settings.roles.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/roles'),
  },
  {
    id: 'features',
    href: '/dashboard/settings/features',
    labelKey: 'tabFeatures',
    hintKey: 'hintFeatures',
    icon: '🧩',
    permission: 'settings.features.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/features'),
  },
  {
    id: 'buffet',
    href: '/dashboard/settings/buffet',
    labelKey: 'tabBuffet',
    hintKey: 'hintBuffet',
    icon: '🍽️',
    permission: 'settings.buffet.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/buffet'),
  },
  {
    id: 'print-assistant',
    href: '/dashboard/settings/print-assistant',
    labelKey: 'tabPrintAssistant',
    hintKey: 'hintPrintAssistant',
    icon: '🖨️',
    permission: 'settings.print_assistant.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/print-assistant'),
  },
  {
    id: 'kitchen-screens',
    href: '/dashboard/settings/kitchen-screens',
    labelKey: 'tabKitchenScreens',
    hintKey: 'hintKitchenScreens',
    icon: '📺',
    permission: 'floor.kitchen_screens.manage',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/kitchen-screens'),
  },
  {
    id: 'system-logs',
    href: '/dashboard/settings/system-logs',
    labelKey: 'tabSystemLogs',
    hintKey: 'hintSystemLogs',
    icon: '📜',
    backendAdminOnPremOnly: true,
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/system-logs'),
  },
];

export function getActiveSettingsNavItem(pathname: string): SettingsNavItem | null {
  return SETTINGS_NAV_TABS.find((item) => item.isActive(pathname)) ?? null;
}

export function isSettingsWideLayout(pathname: string): boolean {
  return pathname.startsWith('/dashboard/settings/buffet');
}
