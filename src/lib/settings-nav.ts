export type SettingsNavId =
  | 'profile'
  | 'tables'
  | 'staff'
  | 'menu'
  | 'buffet'
  | 'print-assistant';

export type SettingsNavGroupId = 'basics' | 'venue' | 'menu' | 'print';

export type SettingsHubLabelKey =
  | 'tabProfile'
  | 'tabTables'
  | 'tabStaff'
  | 'tabMenu'
  | 'tabBuffet'
  | 'tabPrintAssistant';

export type SettingsHubHintKey =
  | 'hintProfile'
  | 'hintTables'
  | 'hintStaff'
  | 'hintMenu'
  | 'hintBuffet'
  | 'hintPrintAssistant';

export type SettingsNavItem = {
  id: SettingsNavId;
  href: string;
  labelKey: SettingsHubLabelKey;
  hintKey: SettingsHubHintKey;
  isActive: (pathname: string) => boolean;
};

export type SettingsNavGroup = {
  groupId: SettingsNavGroupId;
  groupKey: 'groupBasics' | 'groupVenue' | 'groupMenu' | 'groupPrint';
  items: SettingsNavItem[];
};

export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  {
    groupId: 'basics',
    groupKey: 'groupBasics',
    items: [
      {
        id: 'profile',
        href: '/dashboard/settings',
        labelKey: 'tabProfile',
        hintKey: 'hintProfile',
        isActive: (pathname) =>
          pathname === '/dashboard/settings' || pathname === '/dashboard/settings/',
      },
    ],
  },
  {
    groupId: 'venue',
    groupKey: 'groupVenue',
    items: [
      {
        id: 'tables',
        href: '/dashboard/settings/tables',
        labelKey: 'tabTables',
        hintKey: 'hintTables',
        isActive: (pathname) => pathname.startsWith('/dashboard/settings/tables'),
      },
      {
        id: 'staff',
        href: '/dashboard/settings/staff',
        labelKey: 'tabStaff',
        hintKey: 'hintStaff',
        isActive: (pathname) => pathname.startsWith('/dashboard/settings/staff'),
      },
    ],
  },
  {
    groupId: 'menu',
    groupKey: 'groupMenu',
    items: [
      {
        id: 'menu',
        href: '/dashboard/settings/menu',
        labelKey: 'tabMenu',
        hintKey: 'hintMenu',
        isActive: (pathname) => pathname.startsWith('/dashboard/settings/menu'),
      },
      {
        id: 'buffet',
        href: '/dashboard/settings/buffet',
        labelKey: 'tabBuffet',
        hintKey: 'hintBuffet',
        isActive: (pathname) => pathname.startsWith('/dashboard/settings/buffet'),
      },
    ],
  },
  {
    groupId: 'print',
    groupKey: 'groupPrint',
    items: [
      {
        id: 'print-assistant',
        href: '/dashboard/settings/print-assistant',
        labelKey: 'tabPrintAssistant',
        hintKey: 'hintPrintAssistant',
        isActive: (pathname) => pathname.startsWith('/dashboard/settings/print-assistant'),
      },
    ],
  },
];

export function getActiveSettingsNavItem(pathname: string): SettingsNavItem | null {
  for (const group of SETTINGS_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.isActive(pathname)) return item;
    }
  }
  return null;
}

export function getActiveSettingsNavGroup(pathname: string): SettingsNavGroup | null {
  for (const group of SETTINGS_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.isActive(pathname)) return group;
    }
  }
  return null;
}

export function isSettingsWideLayout(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard/settings/menu') ||
    pathname.startsWith('/dashboard/settings/buffet')
  );
}
