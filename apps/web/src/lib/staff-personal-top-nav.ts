/** Nav item config for StaffPersonalTopBar (role shells outside dashboard). */
export type StaffPersonalTopNavItem = {
  id: string;
  href: string;
  labelKey: string;
  icon: string;
  exact?: boolean;
  matchPrefix?: string;
  external?: boolean;
};

export type StaffPersonalTopNavPresentation = {
  items: StaffPersonalTopNavItem[];
  quickActions: StaffPersonalTopNavItem[];
};

export function buildStaffPersonalTopNavPresentation(
  navItems: StaffPersonalTopNavItem[],
  logoHref: string,
): StaffPersonalTopNavPresentation {
  const items = navItems;
  const quickActions = navItems.filter((item) => item.href !== logoHref);
  return { items, quickActions };
}

export function isStaffLogoHrefActive(pathname: string, logoHref: string): boolean {
  return pathname === logoHref || pathname.startsWith(`${logoHref}/`);
}

export function isStaffPersonalNavItemActive(
  pathname: string,
  item: Pick<StaffPersonalTopNavItem, 'href' | 'exact' | 'matchPrefix'>,
): boolean {
  if (item.matchPrefix) {
    return pathname === item.matchPrefix || pathname.startsWith(`${item.matchPrefix}/`);
  }
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname.startsWith(item.href);
}
