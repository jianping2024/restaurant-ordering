export async function requestDashboardCheckoutRequest(
  tableId: string,
): Promise<{ ok: true; bill_split_id: string } | { ok: false; error: string }> {
  try {
    const res = await fetch('/api/dashboard/checkout-request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table_id: tableId }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      bill_split_id?: string;
      error?: string;
    };
    if (!res.ok || !data.bill_split_id) {
      return { ok: false, error: data.error || 'checkout_request_failed' };
    }
    return { ok: true, bill_split_id: data.bill_split_id };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
