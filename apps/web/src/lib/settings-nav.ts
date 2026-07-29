import type { PermissionKey } from '@/lib/permissions/registry';

export type SettingsNavId =
  | 'profile'
  | 'features'
  | 'staff'
  | 'roles'
  | 'buffet'
  | 'print-assistant';

export type SettingsHubLabelKey =
  | 'tabProfile'
  | 'tabFeatures'
  | 'tabStaff'
  | 'tabRoles'
  | 'tabBuffet'
  | 'tabPrintAssistant';

export type SettingsHubHintKey =
  | 'hintProfile'
  | 'hintFeatures'
  | 'hintBuffet'
  | 'hintPrintAssistant';

export type SettingsNavItem = {
  id: SettingsNavId;
  href: string;
  labelKey: SettingsHubLabelKey;
  hintKey?: SettingsHubHintKey;
  icon: string;
  permission: PermissionKey;
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
];

export function getActiveSettingsNavItem(pathname: string): SettingsNavItem | null {
  return SETTINGS_NAV_TABS.find((item) => item.isActive(pathname)) ?? null;
}

export function isSettingsWideLayout(pathname: string): boolean {
  return pathname.startsWith('/dashboard/settings/buffet');
}
