/** Staff floor「呼叫结账」— sole client for POST …/checkout/ensure-entry. */
export async function requestEnsureStaffCheckoutEntry(params: {
  slug: string;
  tableId: string;
}): Promise<
  | { ok: true; bill_split_id: string; split_mode: string }
  | { ok: false; error: string }
> {
  const { slug, tableId } = params;
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/checkout/ensure-entry`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      bill_split_id?: string;
      split_mode?: string;
      error?: string;
    };
    if (!res.ok || !data.bill_split_id) {
      return { ok: false, error: data.error || 'checkout_request_failed' };
    }
    return {
      ok: true,
      bill_split_id: data.bill_split_id,
      split_mode: typeof data.split_mode === 'string' ? data.split_mode : '',
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
