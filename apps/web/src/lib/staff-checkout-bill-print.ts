import { clampCheckoutDiscountRate } from '@/lib/checkout-split-math';
import {
  requestOrderReceiptPrint,
  type OrderReceiptPrintResult,
} from '@/lib/request-order-receipt-print';
import type { OrderHistoryBillSplitRef } from '@/lib/order-history-bill-splits';

export type StaffCheckoutBillPrintTarget = OrderHistoryBillSplitRef;

export function staffCheckoutBillDiscountRate(
  billSplit: StaffCheckoutBillPrintTarget,
  liveRate?: number,
): number {
  return clampCheckoutDiscountRate(liveRate ?? billSplit.discount_rate ?? 0);
}

/** Manual checkout_bill print — same path as dashboard checkout; not gated by bill_receipt_print. */
export async function requestStaffCheckoutBillPrint(params: {
  slug: string;
  billSplit: StaffCheckoutBillPrintTarget;
  discountRate?: number;
}): Promise<OrderReceiptPrintResult> {
  const { slug, billSplit, discountRate } = params;
  return requestOrderReceiptPrint({
    slug,
    tableId: billSplit.table_id,
    sessionId: billSplit.session_id ?? undefined,
    billSplitId: billSplit.id,
    receiptVariant: 'checkout_bill',
    discountRate: staffCheckoutBillDiscountRate(billSplit, discountRate),
  });
}
