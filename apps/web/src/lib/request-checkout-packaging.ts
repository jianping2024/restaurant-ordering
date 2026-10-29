import type { PackagingLineInput } from '@/lib/checkout-packaging';

export type CheckoutPackagingRequestResult = { ok: true } | { ok: false; error: string };

async function sendCheckoutPackaging(
  slug: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>,
): Promise<CheckoutPackagingRequestResult> {
  try {
    const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/checkout/packaging`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || 'packaging_failed' };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

/** Add packaging supply lines (`menu_item_id` + qty) on a takeaway session bill. */
export function requestAddCheckoutPackaging(params: {
  slug: string;
  billSplitId: string;
  lines: PackagingLineInput[];
  clientRequestId: string;
}): Promise<CheckoutPackagingRequestResult> {
  return sendCheckoutPackaging(params.slug, 'POST', {
    bill_split_id: params.billSplitId,
    lines: params.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      qty: line.qty,
    })),
    client_request_id: params.clientRequestId,
  });
}

/** Remove one packaging line by its order line id (`packaging:<uuid>`). */
export function requestRemoveCheckoutPackaging(params: {
  slug: string;
  billSplitId: string;
  lineId: string;
}): Promise<CheckoutPackagingRequestResult> {
  return sendCheckoutPackaging(params.slug, 'DELETE', {
    bill_split_id: params.billSplitId,
    line_id: params.lineId,
  });
}
