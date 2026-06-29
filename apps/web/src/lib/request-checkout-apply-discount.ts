export async function requestCheckoutApplyDiscount(params: {
  slug: string;
  billSplitId: string;
  discountRate: number;
  discountReason?: string;
  discountReasonDetail?: string;
}): Promise<
  | {
      ok: true;
      discount_rate: number;
      discount_reason: string | null;
      discount_reason_detail: string | null;
    }
  | { ok: false; error: string }
> {
  const { slug, billSplitId, discountRate, discountReason, discountReasonDetail } = params;
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/checkout/apply-discount`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_split_id: billSplitId,
          discount_rate: discountRate,
          ...(discountReason ? { discount_reason: discountReason } : {}),
          ...(discountReasonDetail ? { discount_reason_detail: discountReasonDetail } : {}),
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      discount_rate?: number;
      discount_reason?: string | null;
      discount_reason_detail?: string | null;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'apply_discount_failed' };
    }
    return {
      ok: true,
      discount_rate: Number(data.discount_rate) || 0,
      discount_reason: data.discount_reason ?? null,
      discount_reason_detail: data.discount_reason_detail ?? null,
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
