'use client';

type DecrementOrderItemResponse = {
  ok?: boolean;
  order?: unknown;
  outcome?: 'decremented' | 'voided';
  error?: string;
};

export async function postWaiterDecrementOrderItemClient(
  slug: string,
  orderId: string,
  body: { item_index: number; updated_at: string },
): Promise<{ outcome: 'decremented' | 'voided' }> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/waiter/orders/${encodeURIComponent(orderId)}/decrement-item`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as DecrementOrderItemResponse;
  if (!res.ok) {
    const err = new Error(data.error || 'decrement_item_failed') as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return { outcome: data.outcome ?? 'decremented' };
}
