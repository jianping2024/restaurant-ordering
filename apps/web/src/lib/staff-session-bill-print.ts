import {
  requestOrderReceiptPrint,
  type OrderReceiptPrintResult,
} from '@/lib/request-order-receipt-print';

/** Session-level checkout_bill (no bill_split) — manual staff print, not gated by bill_receipt_print. */
export async function requestStaffSessionBillPrint(params: {
  slug: string;
  tableId: string;
  sessionId: string;
}): Promise<OrderReceiptPrintResult> {
  const { slug, tableId, sessionId } = params;
  return requestOrderReceiptPrint({
    slug,
    tableId,
    sessionId,
    receiptVariant: 'checkout_bill',
  });
}
