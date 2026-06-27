export type SettingsNavId =
  | 'profile'
  | 'features'
  | 'staff'
  | 'buffet'
  | 'print-assistant';

export type SettingsHubLabelKey =
  | 'tabProfile'
  | 'tabFeatures'
  | 'tabStaff'
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
  isActive: (pathname: string) => boolean;
};

export const SETTINGS_NAV_TABS: SettingsNavItem[] = [
  {
    id: 'profile',
    href: '/dashboard/settings',
    labelKey: 'tabProfile',
    hintKey: 'hintProfile',
    icon: '🏪',
    isActive: (pathname) =>
      pathname === '/dashboard/settings' || pathname === '/dashboard/settings/',
  },
  {
    id: 'staff',
    href: '/dashboard/settings/staff',
    labelKey: 'tabStaff',
    icon: '👥',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/staff'),
  },
  {
    id: 'features',
    href: '/dashboard/settings/features',
    labelKey: 'tabFeatures',
    hintKey: 'hintFeatures',
    icon: '🧩',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/features'),
  },
  {
    id: 'buffet',
    href: '/dashboard/settings/buffet',
    labelKey: 'tabBuffet',
    hintKey: 'hintBuffet',
    icon: '🍽️',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/buffet'),
  },
  {
    id: 'print-assistant',
    href: '/dashboard/settings/print-assistant',
    labelKey: 'tabPrintAssistant',
    hintKey: 'hintPrintAssistant',
    icon: '🖨️',
    isActive: (pathname) => pathname.startsWith('/dashboard/settings/print-assistant'),
  },
];

export function getActiveSettingsNavItem(pathname: string): SettingsNavItem | null {
  return SETTINGS_NAV_TABS.find((item) => item.isActive(pathname)) ?? null;
}

export function isSettingsWideLayout(pathname: string): boolean {
  return pathname.startsWith('/dashboard/settings/buffet');
}
