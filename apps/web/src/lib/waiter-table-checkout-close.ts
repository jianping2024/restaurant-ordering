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

/**
 * Floor checkout close (settled: preserve orders + write settlement).
 * When printBill is true: print session total bill (`checkout_bill`), then close.
 * When false: close only (no print).
 */
export async function runWaiterTableCheckoutClose(params: {
  slug: string;
  tableId: string;
  sessionId: string;
  printBill: boolean;
}): Promise<WaiterTableCheckoutCloseResult> {
  const { slug, tableId, sessionId, printBill } = params;

  if (printBill) {
    const printOutcome = await requestStaffSessionBillPrint({ slug, tableId, sessionId });
    if (!printOutcome.ok) {
      return { ok: false, stage: 'print', code: printOutcome.error };
    }
  }

  const { status, body } = await postCheckoutCloseTableSessionClient({ table_id: tableId });
  if (status === 200 && body.ok !== false) {
    return { ok: true };
  }

  const code = body.error ?? 'close_failed';
  if (code === 'no_session') {
    return { ok: false, stage: 'close', code };
  }
  return { ok: false, stage: 'close', code, message: body.message };
}
