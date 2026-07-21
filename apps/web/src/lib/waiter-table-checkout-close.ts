import { postCheckoutCloseTableSessionClient } from '@/lib/checkout-close-table-session-client';
import { requestStaffSessionBillPrint } from '@/lib/staff-session-bill-print';

export type CheckoutCloseFloorRole = 'frontdesk' | 'cashier';

export type WaiterTableCheckoutCloseResult =
  | { ok: true }
  | {
      ok: false;
      stage: 'print' | 'close';
      code: string;
      message?: string;
    };

/** Frontdesk prints session bill before close; cashier closes without printing. */
export function checkoutCloseShouldPrintBill(role: CheckoutCloseFloorRole): boolean {
  return role === 'frontdesk';
}

/**
 * Floor checkout close (settled: preserve orders + write settlement).
 * Frontdesk: print session total bill (`checkout_bill`), then close.
 * Cashier: close only (no print).
 */
export async function runWaiterTableCheckoutClose(params: {
  slug: string;
  tableId: string;
  sessionId: string;
  floorStaffRole: CheckoutCloseFloorRole;
}): Promise<WaiterTableCheckoutCloseResult> {
  const { slug, tableId, sessionId, floorStaffRole } = params;

  if (checkoutCloseShouldPrintBill(floorStaffRole)) {
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
