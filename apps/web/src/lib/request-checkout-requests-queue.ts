import type { CheckoutRequestSummary } from '@/lib/checkout-request-summary';

type CheckoutRequestsResponse = {
  requests?: CheckoutRequestSummary[];
  error?: string;
};

type CheckoutRequestDetailResponse = {
  request?: import('@/types').BillSplit;
  error?: string;
};

/** Staff checkout queue via authenticated API (shared by layout provider + SSR). */
export async function requestCheckoutRequestsQueue(slug: string): Promise<CheckoutRequestSummary[]> {
  const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/checkout/requests`, {
    credentials: 'include',
  });
  const data = (await res.json().catch(() => ({}))) as CheckoutRequestsResponse;
  if (!res.ok) {
    throw new Error(data.error || 'checkout_requests_fetch_failed');
  }
  return data.requests || [];
}

export async function requestCheckoutRequestDetail(
  slug: string,
  billSplitId: string,
): Promise<import('@/types').BillSplit | null> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/checkout/requests/${encodeURIComponent(billSplitId)}`,
    { credentials: 'include' },
  );
  if (res.status === 404) return null;
  const data = (await res.json().catch(() => ({}))) as CheckoutRequestDetailResponse;
  if (!res.ok) {
    throw new Error(data.error || 'checkout_request_detail_failed');
  }
  return data.request ?? null;
}
