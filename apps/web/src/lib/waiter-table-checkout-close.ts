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

/** Empty session: skip print and continue close. Other print failures still block. */
export function isNonBlockingCheckoutClosePrintError(code: string): boolean {
  return code === 'no_orders';
}

/**
 * Floor checkout close (settled: preserve orders + write settlement).
 * When printBill is true: print session total bill (`checkout_bill`), then close.
 * When false: close only (no print).
 * Empty session (`no_orders`) skips print and still closes.
 */
export async function runWaiterTableCheckoutClose(
  params: {
    slug: string;
    tableId: string;
    sessionId: string;
    printBill: boolean;
  },
  options?: {
    requestBillPrint?: typeof requestStaffSessionBillPrint;
    postClose?: typeof postCheckoutCloseTableSessionClient;
  },
): Promise<WaiterTableCheckoutCloseResult> {
  const { slug, tableId, sessionId, printBill } = params;
  const requestBillPrint = options?.requestBillPrint ?? requestStaffSessionBillPrint;
  const postClose = options?.postClose ?? postCheckoutCloseTableSessionClient;

  if (printBill) {
    const printOutcome = await requestBillPrint({ slug, tableId, sessionId });
    if (!printOutcome.ok && !isNonBlockingCheckoutClosePrintError(printOutcome.error)) {
      return { ok: false, stage: 'print', code: printOutcome.error };
    }
  }

  const { status, body } = await postClose({ table_id: tableId });
  if (status === 200 && body.ok !== false) {
    return { ok: true };
  }

  const code = body.error ?? 'close_failed';
  if (code === 'no_session') {
    return { ok: false, stage: 'close', code };
  }
  return { ok: false, stage: 'close', code, message: body.message };
}
