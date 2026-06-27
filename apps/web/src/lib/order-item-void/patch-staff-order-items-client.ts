'use client';

import type { Order, OrderItem } from '@/types';

export type StaffOrderItemsPatchSurface = 'kitchen' | 'waiter';

export type PatchStaffOrderItemsBody = {
  items: OrderItem[];
  updated_at: string;
  void_reason?: string;
  void_reason_detail?: string;
};

export type PatchStaffOrderItemsResult =
  | { ok: true; order: Order }
  | { ok: false; status: number; error?: string };

export async function patchStaffOrderItemsClient(
  surface: StaffOrderItemsPatchSurface,
  slug: string,
  orderId: string,
  body: PatchStaffOrderItemsBody,
): Promise<PatchStaffOrderItemsResult> {
  const res = await fetch(
    `/api/restaurants/${encodeURIComponent(slug)}/staff/${surface}/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json().catch(() => ({}))) as { order?: Order; error?: string };
  if (!res.ok) {
    return { ok: false, status: res.status, error: data.error };
  }
  return { ok: true, order: data.order as Order };
}
