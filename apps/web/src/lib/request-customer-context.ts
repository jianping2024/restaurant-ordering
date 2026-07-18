import type { CustomerSessionContext } from '@/lib/customer-session-context';
import type { CustomerBillPageModel, CustomerBillRefresh } from '@/lib/customer-bill-load';
import type { BillSplit, Order, TableSession } from '@/types';

export type CustomerSessionResponse = CustomerSessionContext;

/** @deprecated Prefer CustomerBillPageModel — kept for typed page consumers. */
export type CustomerBillCollectedPayment = CustomerBillPageModel['collected_payments'][number];

export type CustomerBillResponse = CustomerBillPageModel;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function requestCustomerSessionContext(slug: string, tableId: string) {
  return fetchJson<CustomerSessionResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/session?table_id=${encodeURIComponent(tableId)}`,
  );
}

export function requestCustomerBillContext(slug: string, tableId: string) {
  return fetchJson<CustomerBillResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/bill?table_id=${encodeURIComponent(tableId)}`,
  );
}

export function requestCustomerBillRefresh(slug: string, tableId: string) {
  return fetchJson<CustomerBillRefresh>(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/bill/refresh?table_id=${encodeURIComponent(tableId)}`,
  );
}

export type { CustomerBillRefresh, Order, BillSplit, TableSession };
