import type { TakeawayLineInput } from '@/lib/checkout-takeaway';

export type CheckoutTakeawayRequestResult = { ok: true } | { ok: false; error: string };

async function sendCheckoutTakeaway(
  slug: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>,
): Promise<CheckoutTakeawayRequestResult> {
  try {
    const res = await fetch(`/api/restaurants/${encodeURIComponent(slug)}/checkout/takeaway`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error || 'takeaway_failed' };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}

/** Add take-away charge lines (`lines` = unit price + qty). */
export function requestAddCheckoutTakeaway(params: {
  slug: string;
  billSplitId: string;
  lines: TakeawayLineInput[];
  /** Same id for retries of one confirm (server replays instead of double-adding). */
  clientRequestId: string;
}): Promise<CheckoutTakeawayRequestResult> {
  return sendCheckoutTakeaway(params.slug, 'POST', {
    bill_split_id: params.billSplitId,
    lines: params.lines,
    client_request_id: params.clientRequestId,
  });
}

/** Remove one take-away line by its order line id (`takeaway:<uuid>`). */
export function requestRemoveCheckoutTakeaway(params: {
  slug: string;
  billSplitId: string;
  lineId: string;
}): Promise<CheckoutTakeawayRequestResult> {
  return sendCheckoutTakeaway(params.slug, 'DELETE', {
    bill_split_id: params.billSplitId,
    line_id: params.lineId,
  });
}
