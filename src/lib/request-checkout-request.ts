import type { SplitMode, SplitPerson, SplitResult } from '@/types';

export async function requestCheckoutRequest(params: {
  slug: string;
  tableId: string;
  splitMode: SplitMode | null;
  persons: SplitPerson[];
  result: SplitResult[];
  customerNif?: string | null;
}): Promise<{ ok: true; bill_split_id: string; result: SplitResult[] } | { ok: false; error: string }> {
  const { slug, tableId, splitMode, persons, result, customerNif } = params;
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/checkout/request`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          split_mode: splitMode ?? 'custom',
          persons,
          result,
          ...(customerNif ? { customer_nif: customerNif } : {}),
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      bill_split_id?: string;
      error?: string;
      result?: SplitResult[];
    };
    if (!res.ok || !data.bill_split_id) {
      return { ok: false, error: data.error || 'checkout_request_failed' };
    }
    return {
      ok: true,
      bill_split_id: data.bill_split_id,
      result: (data.result || result) as SplitResult[],
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
