import type { StaffRole } from '@/lib/staff-account';
import { dashboardCheckoutTableHref } from '@/lib/checkout-queue-focus';

export { dashboardCheckoutTableHref } from '@/lib/checkout-queue-focus';

type WaiterRouteOptions = {
  embeddedInDashboard?: boolean;
  isDemo?: boolean;
};

/** Post-login / session paths by staff role (safe for server and client). */
export function staffRolePath(slug: string, role: StaffRole): string {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  if (role === 'cashier') return '/dashboard/checkout';
  if (role === 'frontdesk') return '/dashboard/waiter';
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

/** Waiter board → menu link for assisted ordering (`from=waiter` + encoded return path). */
export function waiterMenuHref(
  slug: string,
  tableId: string,
  options: WaiterRouteOptions = {},
): string {
  const menuBase = options.isDemo ? '/demo/menu' : `/${slug}/menu`;
  const params = new URLSearchParams({
    table_id: tableId,
    from: 'waiter',
    return: waiterTableHref(slug, tableId, options),
  });
  return `${menuBase}?${params.toString()}`;
}

/** Waiter board → bill link for assisted checkout (same flow as customer menu → bill). */
export function waiterBillHref(
  slug: string,
  tableId: string,
  options: WaiterRouteOptions = {},
): string {
  const params = new URLSearchParams({
    table_id: tableId,
    from: 'waiter',
    return: waiterTableHref(slug, tableId, options),
  });
  return `/${slug}/bill?${params.toString()}`;
}

const DASHBOARD_WAITER_BOARD_PREFIX = '/dashboard/waiter';

/** Frontdesk embedded waiter flow (`return=/dashboard/waiter/...`). */
export function isDashboardWaiterReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return (
    returnPath === DASHBOARD_WAITER_BOARD_PREFIX ||
    returnPath.startsWith(`${DASHBOARD_WAITER_BOARD_PREFIX}/`)
  );
}

/** Slug waiter board assisted flow — may order but must not initiate checkout. */
export function isSlugWaiterAssistedFlow(returnPath: string | null | undefined): boolean {
  return !!returnPath && !isDashboardWaiterReturnPath(returnPath);
}

/** After bill checkout request — frontdesk goes to dashboard checkout; others stay on bill. */
export function checkoutRedirectAfterBillRequest(
  tableId: string,
  returnPath: string | null | undefined,
): string | null {
  return isDashboardWaiterReturnPath(returnPath) ? dashboardCheckoutTableHref(tableId) : null;
}

function isSafeInternalReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export type StaffAssistedFlowVariant = 'slug_waiter' | 'dashboard_frontdesk' | 'demo';

/** Resolved staff-assisted customer menu/bill flow (`from=waiter`). */
export type StaffAssistedFlow = {
  returnHref: string;
  variant: StaffAssistedFlowVariant;
  redirectAfterSubmit: boolean;
  showBillCta: boolean;
  skipGeoFence: boolean;
  skipFeedback: boolean;
  checkoutRedirectHref: string | null;
};

/** Return path points at a waiter table detail page (not the board list). */
export function isWaiterTableDetailReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return /\/waiter\/[^/]+$/.test(returnPath);
}

export function resolveStaffAssistedFlow(
  from: string | undefined,
  returnPath: string | undefined,
  slug: string,
  tableId: string,
  options: WaiterRouteOptions = {},
): StaffAssistedFlow | null {
  const returnHref = resolveWaiterMenuReturnHref(from, returnPath, slug, options);
  if (!returnHref) return null;

  const isDashboard = isDashboardWaiterReturnPath(returnHref);
  const isDemo = options.isDemo ?? false;
  const variant: StaffAssistedFlowVariant = isDemo
    ? 'demo'
    : isDashboard
      ? 'dashboard_frontdesk'
      : 'slug_waiter';

  return {
    returnHref,
    variant,
    redirectAfterSubmit: true,
    showBillCta: variant === 'dashboard_frontdesk',
    skipGeoFence: true,
    skipFeedback: true,
    checkoutRedirectHref: checkoutRedirectAfterBillRequest(tableId, returnHref),
  };
}

/** Menu/bill waiter return links — allow slug, dashboard, and demo waiter boards only. */
export function resolveWaiterMenuReturnHref(
  from: string | undefined,
  returnPath: string | undefined,
  slug: string,
  options: WaiterRouteOptions = {},
): string | null {
  if (from !== 'waiter') return null;

  const defaultHref = waiterBoardHref(slug, options);
  if (!returnPath || !isSafeInternalReturnPath(returnPath)) return defaultHref;

  const allowedPrefixes = [
    waiterBoardHref(slug),
    waiterBoardHref(slug, { embeddedInDashboard: true }),
    waiterBoardHref(slug, { isDemo: true }),
  ];

  if (
    allowedPrefixes.some(
      (prefix) => returnPath === prefix || returnPath.startsWith(`${prefix}/`),
    )
  ) {
    return returnPath;
  }

  return defaultHref;
}
