import {
  requestOrderReceiptPrint,
  type OrderReceiptPrintResult,
} from '@/lib/request-order-receipt-print';

type StaffSessionReceiptPrintParams = {
  slug: string;
  tableId: string;
  sessionId: string;
};

/** Session-level checkout_bill (no bill_split) — manual staff print, not gated by bill_receipt_print. */
export async function requestStaffSessionBillPrint(
  params: StaffSessionReceiptPrintParams,
): Promise<OrderReceiptPrintResult> {
  const { slug, tableId, sessionId } = params;
  return requestOrderReceiptPrint({
    slug,
    tableId,
    sessionId,
    receiptVariant: 'checkout_bill',
  });
}

/**
 * Session-level pre_bill (no bill_split) — same paper as automatic call-for-bill pre-bill.
 * Staff auth → staff_manual (ungated); omit bill_split so automatic idempotency does not swallow reprints.
 */
export async function requestStaffSessionPreBillPrint(
  params: StaffSessionReceiptPrintParams,
): Promise<OrderReceiptPrintResult> {
  const { slug, tableId, sessionId } = params;
  return requestOrderReceiptPrint({
    slug,
    tableId,
    sessionId,
    receiptVariant: 'pre_bill',
  });
}
