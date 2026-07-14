import { postCheckoutCloseTableSessionClient } from '@/lib/checkout-close-table-session-client';
import { requestStaffSessionBillPrint } from '@/lib/staff-session-bill-print';

export type WaiterTableCheckoutCloseResult =
  | { ok: true }
  | {
      ok: false;
      stage: 'print' | 'close';
      code: string;
      message?: string;
    };

/** Print session total bill, then normal frontdesk checkout close (operational). */
export async function runWaiterTableCheckoutClose(params: {
  slug: string;
  tableId: string;
  sessionId: string;
}): Promise<WaiterTableCheckoutCloseResult> {
  const { slug, tableId, sessionId } = params;

  const printOutcome = await requestStaffSessionBillPrint({ slug, tableId, sessionId });
  if (!printOutcome.ok) {
    return { ok: false, stage: 'print', code: printOutcome.error };
  }

  const { status, body } = await postCheckoutCloseTableSessionClient({ table_id: tableId });
  if (status === 200 && body.ok !== false) {
    return { ok: true };
  }

  const code = body.error ?? 'close_failed';
  if (code === 'session_billing') {
    return { ok: false, stage: 'close', code };
  }
  if (code === 'no_session') {
    return { ok: false, stage: 'close', code };
  }
  return { ok: false, stage: 'close', code, message: body.message };
}
