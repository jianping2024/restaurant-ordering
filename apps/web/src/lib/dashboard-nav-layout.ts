export const DASHBOARD_NAV_COLLAPSED_STORAGE_KEY = 'mesa:dashboard-nav-collapsed';

export function dashboardNavWidthClass(collapsed: boolean): string {
  return collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64';
}

export function dashboardMainOffsetClass(collapsed: boolean): string {
  return collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64';
}
