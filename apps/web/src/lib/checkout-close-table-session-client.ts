export type CheckoutCloseTableSessionApiBody = {
  ok?: boolean;
  error?: string;
  message?: string;
  session_id?: string;
};

export async function postCheckoutCloseTableSessionClient(body: {
  table_id: string;
}): Promise<{ status: number; body: CheckoutCloseTableSessionApiBody }> {
  const res = await fetch('/api/dashboard/checkout-close-table-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as CheckoutCloseTableSessionApiBody;
  return { status: res.status, body: data };
}
