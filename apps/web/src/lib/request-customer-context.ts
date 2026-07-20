import type {
  CustomerBillContext,
  CustomerBillScope,
  CustomerSessionContext,
  CustomerSessionScope,
} from '@/lib/customer-session-context';

export type CustomerSessionResponse = CustomerSessionContext;
export type CustomerBillResponse = CustomerBillContext;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function requestCustomerSessionContext(
  slug: string,
  tableId: string,
  scope: CustomerSessionScope = 'full',
) {
  const params = new URLSearchParams({
    table_id: tableId,
    scope,
  });
  return fetchJson<CustomerSessionResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/session?${params.toString()}`,
  );
}

export function requestCustomerBillContext(
  slug: string,
  tableId: string,
  scope: CustomerBillScope = 'full',
) {
  const params = new URLSearchParams({
    table_id: tableId,
    scope,
  });
  return fetchJson<CustomerBillResponse>(
    `/api/restaurants/${encodeURIComponent(slug)}/customer/bill?${params.toString()}`,
  );
}
