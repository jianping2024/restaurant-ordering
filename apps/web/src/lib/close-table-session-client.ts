import type { CloseTableSessionApiBody } from '@/lib/close-table-session-ui';

export type CloseTableSessionClientBody = {
  table_id: string;
  confirm_close?: boolean;
  close_reason?: string;
  close_reason_detail?: string;
};

export async function postCloseTableSessionClient(
  body: CloseTableSessionClientBody,
): Promise<{ status: number; body: CloseTableSessionApiBody }> {
  const res = await fetch('/api/dashboard/close-table-session', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_id: body.table_id,
      confirm_close: body.confirm_close === true,
      ...(body.close_reason ? { close_reason: body.close_reason } : {}),
      ...(body.close_reason_detail ? { close_reason_detail: body.close_reason_detail } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as CloseTableSessionApiBody;
  return { status: res.status, body: data };
}
