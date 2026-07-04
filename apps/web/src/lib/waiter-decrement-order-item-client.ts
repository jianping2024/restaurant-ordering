'use client';

import type { Order } from '@/types';

type DecrementOrderItemResponse = {
  ok?: boolean;
  order?: Order;
  outcome?: 'decremented' | 'voided';
  error?: string;
};

export type DecrementOrderItemClientBody = {
  item_index: number;
  updated_at: string;
  void_reason?: string;
  void_reason_detail?: string;
};

export async function postWaiterDecrementOrderItemClient(
  slug: string,
  orderId: string,
  body: DecrementOrderItemClientBody,
): Promise<{ outcome: 'decremented' | 'voided'; order: Order }> {
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
  if (!data.order) {
    throw new Error('decrement_item_missing_order');
  }
  return { outcome: data.outcome ?? 'decremented', order: data.order };
}
