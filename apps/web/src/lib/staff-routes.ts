import type { StaffRole } from '@/lib/staff-account';

type WaiterRouteOptions = {
  embeddedInDashboard?: boolean;
  isDemo?: boolean;
};

/** Post-login / session paths by staff role (safe for server and client). */
export function staffRolePath(slug: string, role: StaffRole): string {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  if (role === 'cashier') return '/dashboard/checkout';
  return `/${slug}/waiter`;
}

export function waiterBoardHref(slug: string, options: WaiterRouteOptions = {}): string {
  if (options.isDemo) return '/demo/waiter';
  if (options.embeddedInDashboard) return '/dashboard/waiter';
  return `/${slug}/waiter`;
}

export function waiterTableHref(
  slug: string,
  tableId: string,
  options: WaiterRouteOptions = {},
): string {
  const encoded = encodeURIComponent(tableId);
  if (options.isDemo) return `/demo/waiter/${encoded}`;
  if (options.embeddedInDashboard) return `/dashboard/waiter/${encoded}`;
  return `/${slug}/waiter/${encoded}`;
}
