import type { SplitResult } from '@/types';

export async function requestCheckoutConfirmPayment(params: {
  slug: string;
  billSplitId: string;
  personIndex: number;
  discountRate?: number;
}): Promise<
  | { ok: true; all_paid: boolean; result: SplitResult[]; final_amount: number }
  | { ok: false; error: string }
> {
  const { slug, billSplitId, personIndex, discountRate } = params;
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/checkout/confirm-payment`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bill_split_id: billSplitId,
          person_index: personIndex,
          ...(discountRate != null ? { discount_rate: discountRate } : {}),
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      all_paid?: boolean;
      result?: SplitResult[];
      final_amount?: number;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'confirm_failed' };
    }
    return {
      ok: true,
      all_paid: !!data.all_paid,
      result: (data.result || []) as SplitResult[],
      final_amount: Number(data.final_amount) || 0,
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
