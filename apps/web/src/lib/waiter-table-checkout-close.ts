import { postCheckoutCloseTableSessionClient } from '@/lib/checkout-close-table-session-client';

export type WaiterTableCheckoutCloseResult =
  | { ok: true; printFailed?: boolean }
  | {
      ok: false;
      stage: 'close';
      code: string;
      message?: string;
    };

/**
 * Floor checkout close (settled payable + close).
 * Optional checkout_bill print is requested on the same close API; print failure never blocks close.
 */
export async function runWaiterTableCheckoutClose(
  params: {
    tableId: string;
    printBill: boolean;
  },
  options?: {
    postClose?: typeof postCheckoutCloseTableSessionClient;
  },
): Promise<WaiterTableCheckoutCloseResult> {
  const { tableId, printBill } = params;
  const postClose = options?.postClose ?? postCheckoutCloseTableSessionClient;

  const { status, body } = await postClose({
    table_id: tableId,
    print_bill: printBill,
  });
  if (status === 200 && body.ok !== false) {
    return {
      ok: true,
      printFailed: printBill && body.print_ok === false,
    };
  }

  const code = body.error ?? 'close_failed';
  if (code === 'no_session') {
    return { ok: false, stage: 'close', code };
  }
  return { ok: false, stage: 'close', code, message: body.message };
}
