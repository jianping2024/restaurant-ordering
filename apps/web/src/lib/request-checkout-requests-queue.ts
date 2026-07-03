import type { BillSplit } from '@/types';

type CheckoutRequestsResponse = {
  requests?: BillSplit[];
  count?: number;
  error?: string;
};

async function fetchCheckoutRequestsApi(
  slug: string,
  countOnly: boolean,
): Promise<CheckoutRequestsResponse> {
  const query = countOnly ? '?count_only=1' : '';
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/checkout/requests${query}`,
    { credentials: 'include' },
  );
  const data = (await res.json().catch(() => ({}))) as CheckoutRequestsResponse;
  if (!res.ok) {
    throw new Error(data.error || 'checkout_requests_fetch_failed');
  }
  return data;
}

/** Staff checkout queue via authenticated API (same path as SSR reconcile). */
export async function requestCheckoutRequestsQueue(slug: string): Promise<BillSplit[]> {
  const data = await fetchCheckoutRequestsApi(slug, false);
  return data.requests || [];
}

/** Nav badge count via authenticated API. */
export async function requestCheckoutRequestsCount(slug: string): Promise<number> {
  const data = await fetchCheckoutRequestsApi(slug, true);
  return data.count ?? 0;
}
