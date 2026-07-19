import type { StaffRole } from '@/lib/staff-account';
import { dashboardCheckoutTableHref } from '@/lib/checkout-queue-focus';

export { dashboardCheckoutTableHref } from '@/lib/checkout-queue-focus';

type WaiterRouteOptions = {
  /** @deprecated Production board is always Dashboard; kept for call-site compatibility. */
  embeddedInDashboard?: boolean;
  isDemo?: boolean;
};

const DASHBOARD_WAITER_BOARD_PREFIX = '/dashboard/waiter';

/** Post-login / session paths by staff role (safe for server and client). */
export function staffRolePath(slug: string, role: StaffRole): string {
  if (role === 'kitchen') return `/${slug}/kitchen`;
  return DASHBOARD_WAITER_BOARD_PREFIX;
}

export function waiterBoardHref(_slug: string, options: WaiterRouteOptions = {}): string {
  if (options.isDemo) return '/demo/waiter';
  return DASHBOARD_WAITER_BOARD_PREFIX;
}

export function waiterTableHref(
  slug: string,
  tableId: string,
  options: WaiterRouteOptions = {},
): string {
  const encoded = encodeURIComponent(tableId);
  if (options.isDemo) return `/demo/waiter/${encoded}`;
  return `${DASHBOARD_WAITER_BOARD_PREFIX}/${encoded}`;
}

/** Legacy slug board paths — still accepted as assisted `return`, then normalized to Dashboard. */
export function slugWaiterBoardHref(slug: string): string {
  return `/${slug}/waiter`;
}

export function slugWaiterTableHref(slug: string, tableId: string): string {
  return `/${slug}/waiter/${encodeURIComponent(tableId)}`;
}

/** Map legacy `/{slug}/waiter…` return paths onto `/dashboard/waiter…`. */
export function normalizeWaiterReturnPath(path: string, slug: string): string {
  const slugBoard = slugWaiterBoardHref(slug);
  if (path === slugBoard) return DASHBOARD_WAITER_BOARD_PREFIX;
  if (path.startsWith(`${slugBoard}/`)) {
    return `${DASHBOARD_WAITER_BOARD_PREFIX}/${path.slice(slugBoard.length + 1)}`;
  }
  return path;
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

/** Frontdesk embedded waiter flow (`return=/dashboard/waiter/...`). */
export function isDashboardWaiterReturnPath(returnPath: string | null | undefined): boolean {
  if (!returnPath) return false;
  return (
    returnPath === DASHBOARD_WAITER_BOARD_PREFIX ||
    returnPath.startsWith(`${DASHBOARD_WAITER_BOARD_PREFIX}/`)
  );
}

function isSlugWaiterReturnPath(returnPath: string, slug: string): boolean {
  const prefix = slugWaiterBoardHref(slug);
  return returnPath === prefix || returnPath.startsWith(`${prefix}/`);
}

/** After bill checkout request — only when assisted flow allows desk checkout. */
export function checkoutRedirectAfterBillRequest(
  tableId: string,
  canAssistBillCheckout: boolean,
): string | null {
  return canAssistBillCheckout ? dashboardCheckoutTableHref(tableId) : null;
}

function isSafeInternalReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('://');
}

export type StaffAssistedFlowVariant = 'staff' | 'demo';

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

export type ResolveStaffAssistedFlowOptions = WaiterRouteOptions & {
  /** Desk roles may assist checkout; waiter may order only. Default false (safe). */
  canAssistBillCheckout?: boolean;
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
  options: ResolveStaffAssistedFlowOptions = {},
): StaffAssistedFlow | null {
  const returnHref = resolveWaiterMenuReturnHref(from, returnPath, slug, options);
  if (!returnHref) return null;

  const isDemo = options.isDemo ?? false;
  const canAssistBillCheckout = isDemo ? false : Boolean(options.canAssistBillCheckout);

  return {
    returnHref,
    variant: isDemo ? 'demo' : 'staff',
    redirectAfterSubmit: true,
    showBillCta: canAssistBillCheckout,
    skipGeoFence: true,
    skipFeedback: true,
    checkoutRedirectHref: checkoutRedirectAfterBillRequest(tableId, canAssistBillCheckout),
  };
}

/** Menu/bill waiter return links — allow slug (legacy), dashboard, and demo boards only. */
export function resolveWaiterMenuReturnHref(
  from: string | undefined,
  returnPath: string | undefined,
  slug: string,
  options: WaiterRouteOptions = {},
): string | null {
  if (from !== 'waiter') return null;

  const defaultHref = waiterBoardHref(slug, options);
  if (!returnPath || !isSafeInternalReturnPath(returnPath)) return defaultHref;

  if (options.isDemo) {
    const demoBoard = waiterBoardHref(slug, { isDemo: true });
    if (returnPath === demoBoard || returnPath.startsWith(`${demoBoard}/`)) {
      return returnPath;
    }
    return defaultHref;
  }

  if (isDashboardWaiterReturnPath(returnPath)) {
    return returnPath;
  }

  if (isSlugWaiterReturnPath(returnPath, slug)) {
    return normalizeWaiterReturnPath(returnPath, slug);
  }

  return defaultHref;
}
