import type { CustomerSessionContext } from '@/lib/customer-session-context';
import type { BillSplit, Order, TableSession } from '@/types';

export type CustomerSessionResponse = CustomerSessionContext;

export type CustomerBillCollectedPayment = {
  id: string;
  person_name: string;
  amount: number;
  created_at: string;
};

export type CustomerBillResponse = {
  table_id: string;
  display_name: string;
  active_session: TableSession | null;
  orders: Order[];
  existing_split: BillSplit | null;
  collected_payments: CustomerBillCollectedPayment[];
  /** Together-group size for this table (0 = not in a party). */
  party_member_count: number;
};

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
