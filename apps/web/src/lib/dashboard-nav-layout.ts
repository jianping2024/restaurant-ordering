export const DASHBOARD_NAV_COLLAPSED_STORAGE_KEY = 'mesa:dashboard-nav-collapsed';

export const DASHBOARD_NAV_WIDTH_EXPANDED = '16rem';
export const DASHBOARD_NAV_WIDTH_COLLAPSED = '4.5rem';

export function dashboardNavWidthRem(collapsed: boolean): string {
  return collapsed ? DASHBOARD_NAV_WIDTH_COLLAPSED : DASHBOARD_NAV_WIDTH_EXPANDED;
}

/** Desktop shell: first column = sidebar, second = main. Mobile uses block + fixed drawer. */
export function dashboardShellGridClass(collapsed: boolean): string {
  return collapsed
    ? 'lg:[grid-template-columns:4.5rem_minmax(0,1fr)]'
    : 'lg:[grid-template-columns:16rem_minmax(0,1fr)]';
}

/** @deprecated Prefer dashboardShellGridClass; kept for regression tests. */
export function dashboardNavWidthClass(collapsed: boolean): string {
  return collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64';
}

/** @deprecated Prefer dashboardShellGridClass; kept for regression tests. */
export function dashboardMainOffsetClass(collapsed: boolean): string {
  return collapsed ? 'lg:ml-[4.5rem]' : 'lg:ml-64';
}
