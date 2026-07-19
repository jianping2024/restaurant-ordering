import { parseTableIdParam, tableIdsEqual } from '@/lib/restaurant-tables';

/** URL intent: which checkout queue row to open on `/dashboard/checkout`. */
export type CheckoutQueueFocus = {
  tableId?: string;
  requestId?: string;
};

export function parseCheckoutQueueFocus(input: {
  table_id?: string | null;
  request_id?: string | null;
}): CheckoutQueueFocus | null {
  const tableId =
    typeof input.table_id === 'string' ? parseTableIdParam(input.table_id.trim()) : null;
  const requestId =
    typeof input.request_id === 'string' && input.request_id.trim()
      ? input.request_id.trim()
      : null;
  if (!tableId && !requestId) return null;
  return {
    ...(tableId ? { tableId } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

export function hasCheckoutQueueFocus(
  focus: CheckoutQueueFocus | null | undefined,
): focus is CheckoutQueueFocus {
  return !!(focus?.tableId || focus?.requestId);
}

export function checkoutQueueFocusKey(focus: CheckoutQueueFocus | null | undefined): string {
  if (!focus) return '';
  return `${focus.requestId ?? ''}:${focus.tableId ?? ''}`;
}

type CheckoutQueueFocusRow = {
  id: string;
  table_id: string;
};

/** Resolve queue row id from focus intent; prefers request_id over table_id. */
export function resolveFocusedRequestId(
  requests: readonly CheckoutQueueFocusRow[],
  focus: CheckoutQueueFocus | null | undefined,
): string | null {
  if (!focus) return null;
  if (focus.requestId) {
    const byId = requests.find((row) => row.id === focus.requestId);
    if (byId) return byId.id;
  }
  if (focus.tableId) {
    const byTable = requests.find((row) => tableIdsEqual(row.table_id, focus.tableId!));
    if (byTable) return byTable.id;
  }
  return null;
}

export function dashboardCheckoutFocusHref(input: {
  tableId: string;
  requestId?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set('table_id', input.tableId);
  if (input.requestId) params.set('request_id', input.requestId);
  return `/dashboard/checkout?${params.toString()}`;
}

/** Dashboard checkout deep link by table (waiter redirect, legacy entry). */
export function dashboardCheckoutTableHref(tableId: string): string {
  return dashboardCheckoutFocusHref({ tableId });
}
