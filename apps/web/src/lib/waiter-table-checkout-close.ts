import { postCloseTableSessionClient } from '@/lib/close-table-session-client';
import { interpretCloseTableSessionResponse } from '@/lib/close-table-session-ui';
import { requestStaffSessionBillPrint } from '@/lib/staff-session-bill-print';

export type WaiterTableCheckoutCloseResult =
  | { ok: true }
  | {
      ok: false;
      stage: 'print' | 'close';
      code: string;
      message?: string;
    };

/** Print session total bill, then force-close the table (frontdesk shortcut). */
export async function runWaiterTableCheckoutClose(params: {
  slug: string;
  tableId: string;
  sessionId: string;
  closeReason: string;
  closeReasonDetail?: string;
}): Promise<WaiterTableCheckoutCloseResult> {
  const { slug, tableId, sessionId, closeReason, closeReasonDetail } = params;

  const printOutcome = await requestStaffSessionBillPrint({ slug, tableId, sessionId });
  if (!printOutcome.ok) {
    return { ok: false, stage: 'print', code: printOutcome.error };
  }

  const { status, body } = await postCloseTableSessionClient({
    table_id: tableId,
    confirm_close: true,
    close_reason: closeReason,
    close_reason_detail: closeReasonDetail,
  });

  const next = interpretCloseTableSessionResponse(status, body);
  if (next.action === 'success') {
    return { ok: true };
  }
  if (next.action === 'forbidden') {
    return { ok: false, stage: 'close', code: 'forbidden', message: next.message };
  }
  if (next.action === 'no_session') {
    return { ok: false, stage: 'close', code: 'no_session' };
  }
  if (
    next.action === 'invalid_reason' ||
    next.action === 'reason_detail_required' ||
    next.action === 'reason_required'
  ) {
    return { ok: false, stage: 'close', code: next.action };
  }
  return { ok: false, stage: 'close', code: 'close_failed' };
}
