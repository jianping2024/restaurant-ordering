import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { SplitResult } from '@/types';

export async function requestCheckoutConfirmPayment(params: {
  slug: string;
  billSplitId: string;
  personIndex: number;
  collectedAmount?: number;
  receiptPrinterId?: string;
}): Promise<
  | {
      ok: true;
      all_paid: boolean;
      result: SplitResult[];
      final_amount: number;
      collection: SessionCollectedPayment | null;
    }
  | { ok: false; error: string }
> {
  const { slug, billSplitId, personIndex, collectedAmount, receiptPrinterId } = params;
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
          ...(collectedAmount != null ? { collected_amount: collectedAmount } : {}),
          ...(receiptPrinterId ? { receipt_printer_id: receiptPrinterId } : {}),
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      all_paid?: boolean;
      result?: SplitResult[];
      final_amount?: number;
      collection?: SessionCollectedPayment | null;
    };
    if (!res.ok) {
      return { ok: false, error: data.error || 'confirm_failed' };
    }
    return {
      ok: true,
      all_paid: !!data.all_paid,
      result: (data.result || []) as SplitResult[],
      final_amount: Number(data.final_amount) || 0,
      collection: data.collection ?? null,
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
