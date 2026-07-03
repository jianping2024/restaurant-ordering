import type { BillSplit } from '@/types';

type CheckoutRequestsResponse = {
  requests?: BillSplit[];
  error?: string;
};

/** Staff checkout queue via authenticated API (shared by layout provider + SSR). */
export async function requestCheckoutRequestsQueue(slug: string): Promise<BillSplit[]> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/checkout/requests`, {
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as CheckoutRequestsResponse;
  if (!res.ok) {
    throw new Error(data.error || 'checkout_requests_fetch_failed');
  }
  return data.requests || [];
}
