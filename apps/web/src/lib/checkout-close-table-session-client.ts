export type CheckoutCloseTableSessionApiBody = {
  ok?: boolean;
  error?: string;
  message?: string;
  session_id?: string;
  print_ok?: boolean;
};

export async function postCheckoutCloseTableSessionClient(body: {
  table_id: string;
  print_bill?: boolean;
}): Promise<{ status: number; body: CheckoutCloseTableSessionApiBody }> {
  const res = await fetch('/api/dashboard/checkout-close-table-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: body.table_id,
      print_bill: body.print_bill === true,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as CheckoutCloseTableSessionApiBody;
  return { status: res.status, body: data };
}
